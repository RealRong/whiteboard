import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { State } from '@engine-types/instance/state'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { PointerInput } from '@engine-types/common'
import type { Commands } from '@engine-types/commands'
import type {
  MindmapCancelDragOptions,
  MindmapStartDragOptions
} from '@engine-types/commands'
import type {
  DispatchResult,
  MindmapNodeId,
  MindmapTree
} from '@whiteboard/core'
import { getSide as getMindmapSide } from '@whiteboard/core'
import { DEFAULT_TUNING } from '../../../config'
import { MutationExecutor } from '../shared/MutationExecutor'
import { Drag } from './Drag'

type ActorOptions = {
  state: State
  emit: InstanceEventEmitter['emit']
  instance: Pick<InternalInstance, 'state' | 'view' | 'runtime' | 'graph' | 'mutate'>
  mutation: MutationExecutor
}

const isSameOptions = (
  left?: Record<string, unknown>,
  right?: Record<string, unknown>
) => {
  if (!left || !right) return !left && !right

  const leftKeys = Object.keys(left)
  const rightKeys = Object.keys(right)
  if (leftKeys.length !== rightKeys.length) return false
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false
  }
  return true
}

const isSameLayout = (
  left: MindmapLayoutConfig,
  right: MindmapLayoutConfig
) =>
  left.mode === right.mode &&
  isSameOptions(
    left.options as Record<string, unknown> | undefined,
    right.options as Record<string, unknown> | undefined
  )

const cloneLayout = (
  layout: MindmapLayoutConfig
): MindmapLayoutConfig => ({
  mode: layout.mode,
  options: layout.options
    ? { ...layout.options }
    : undefined
})

export class Actor {
  readonly name = 'Mindmap'

  private readonly state: State
  private readonly emit: InstanceEventEmitter['emit']
  private readonly instance: ActorOptions['instance']
  private readonly mutation: MutationExecutor
  private readonly drag: Drag
  private started = false
  private unsubs: Array<() => void> = []

  private lastLayout: MindmapLayoutConfig | null = null

  constructor({ state, emit, instance, mutation }: ActorOptions) {
    this.state = state
    this.emit = emit
    this.instance = instance
    this.mutation = mutation
    this.drag = new Drag({
      instance,
      mindmap: {
        moveRoot: this.moveRoot,
        moveSubtreeWithDrop: this.moveSubtreeWithDrop
      }
    })
  }

  private runCommand = (
    command: Parameters<MutationExecutor['runCommand']>[0],
    actor: string
  ): Promise<DispatchResult> =>
    this.mutation.runCommand(command, actor)

  private toLayoutHint = (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ) => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  private resolveRootInsertSide = (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ): 'left' | 'right' => {
    if (placement === 'left') return 'left'
    if (placement === 'right') return 'right'
    const layoutSide = layout.options?.side
    return layoutSide === 'left' || layoutSide === 'right'
      ? layoutSide
      : DEFAULT_TUNING.mindmap.defaultSide
  }

  create: Commands['mindmap']['create'] = (payload) =>
    this.runCommand({ type: 'mindmap.create', payload }, 'mindmap.create')

  replace = (id: string, tree: MindmapTree) =>
    this.runCommand({ type: 'mindmap.replace', id, tree }, 'mindmap.replace')

  delete = (ids: string[]) =>
    this.runCommand({ type: 'mindmap.delete', ids }, 'mindmap.delete')

  addChild: Commands['mindmap']['addChild'] = (id, parentId, payload, options) =>
    this.runCommand(
      { type: 'mindmap.addChild', id, parentId, payload, options },
      'mindmap.addChild'
    )

  addSibling: Commands['mindmap']['addSibling'] = (id, nodeId, position, payload, options) =>
    this.runCommand(
      { type: 'mindmap.addSibling', id, nodeId, position, payload, options },
      'mindmap.addSibling'
    )

  moveSubtree: Commands['mindmap']['moveSubtree'] = (id, nodeId, newParentId, options) =>
    this.runCommand(
      { type: 'mindmap.moveSubtree', id, nodeId, newParentId, options },
      'mindmap.moveSubtree'
    )

  removeSubtree: Commands['mindmap']['removeSubtree'] = (id, nodeId) =>
    this.runCommand({ type: 'mindmap.removeSubtree', id, nodeId }, 'mindmap.removeSubtree')

  cloneSubtree: Commands['mindmap']['cloneSubtree'] = (id, nodeId, options) =>
    this.runCommand(
      { type: 'mindmap.cloneSubtree', id, nodeId, options },
      'mindmap.cloneSubtree'
    )

  toggleCollapse: Commands['mindmap']['toggleCollapse'] = (id, nodeId, collapsed) =>
    this.runCommand(
      { type: 'mindmap.toggleCollapse', id, nodeId, collapsed },
      'mindmap.toggleCollapse'
    )

  setNodeData: Commands['mindmap']['setNodeData'] = (id, nodeId, patch) =>
    this.runCommand(
      { type: 'mindmap.setNodeData', id, nodeId, patch },
      'mindmap.setNodeData'
    )

  reorderChild: Commands['mindmap']['reorderChild'] = (id, parentId, fromIndex, toIndex) =>
    this.runCommand(
      { type: 'mindmap.reorderChild', id, parentId, fromIndex, toIndex },
      'mindmap.reorderChild'
    )

  setSide: Commands['mindmap']['setSide'] = (id, nodeId, side) =>
    this.runCommand({ type: 'mindmap.setSide', id, nodeId, side }, 'mindmap.setSide')

  attachExternal: Commands['mindmap']['attachExternal'] = (id, targetId, payload, options) =>
    this.runCommand(
      { type: 'mindmap.attachExternal', id, targetId, payload, options },
      'mindmap.attachExternal'
    )

  insertNode: Commands['mindmap']['insertNode'] = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload = { kind: 'text', text: '' }
  }) => {
    const layoutHint = this.toLayoutHint(targetNodeId, nodeSize, layout)

    if (targetNodeId === tree.rootId) {
      const children = tree.children[targetNodeId] ?? []
      const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
      const side = this.resolveRootInsertSide(placement, layout)
      await this.addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await this.addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getMindmapSide(tree, targetNodeId) ?? DEFAULT_TUNING.mindmap.defaultSide
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await this.addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return
      await this.moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: this.toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await this.addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  moveSubtreeWithLayout: Commands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    this.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: this.toLayoutHint(newParentId, nodeSize, layout)
    })

  moveSubtreeWithDrop: Commands['mindmap']['moveSubtreeWithDrop'] = async ({
    id,
    nodeId,
    drop,
    origin,
    nodeSize,
    layout
  }) => {
    const shouldMove =
      drop.parentId !== origin?.parentId || drop.index !== origin?.index || typeof drop.side !== 'undefined'
    if (!shouldMove) return

    await this.moveSubtreeWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  moveRoot: Commands['mindmap']['moveRoot'] = async ({
    nodeId,
    position,
    threshold = DEFAULT_TUNING.mindmap.rootMoveThreshold
  }) => {
    const node = this.instance.graph.read().canvasNodes.find((item) => item.id === nodeId)
    if (!node) return
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return
    }

    await this.runCommand(
      {
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: position.x, y: position.y }
        }
      },
      'mindmap.moveRoot'
    )
  }

  private emitChanged = (force = false) => {
    const layout = this.state.read('mindmapLayout')
    const changed = !this.lastLayout || !isSameLayout(this.lastLayout, layout)

    if (changed) {
      this.lastLayout = cloneLayout(layout)
    }

    if (!force && !changed) return
    this.emit('mindmap.layout.changed', { layout: cloneLayout(layout) })
  }

  start = () => {
    if (this.started) return
    this.started = true
    this.unsubs = [
      this.state.watch('mindmapLayout', () => this.emitChanged(false))
    ]
    this.emitChanged(true)
  }

  stop = () => {
    if (!this.started && !this.unsubs.length) return
    this.started = false
    this.unsubs.forEach((off) => off())
    this.unsubs = []
  }

  startDrag = (options: MindmapStartDragOptions) =>
    this.drag.start(options)

  updateDrag = (pointer: PointerInput) =>
    this.drag.update({ pointer })

  endDrag = (pointer: PointerInput) =>
    this.drag.end({ pointer })

  cancelDrag = (options?: MindmapCancelDragOptions) =>
    this.drag.cancel(options)

  resetTransientState = () => {
    this.state.write('mindmapDrag', {})
  }
}
