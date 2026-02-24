import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type {
  DispatchResult,
  MindmapId,
  MindmapLayoutHint,
  MindmapNodeId,
  MindmapTree,
  Node,
  Operation
} from '@whiteboard/core/types'
import {
  addChild as addMindmapChild,
  addSibling as addMindmapSibling,
  attachExternal as attachMindmapExternal,
  cloneSubtree as cloneMindmapSubtree,
  createMindmap,
  getSide as getMindmapSide,
  layoutMindmap,
  layoutMindmapTidy,
  moveSubtree as moveMindmapSubtree,
  removeSubtree as removeMindmapSubtree,
  reorderChild as reorderMindmapChild,
  setNodeData as setMindmapNodeData,
  setSide as setMindmapSide,
  toggleCollapse as toggleMindmapCollapse
} from '@whiteboard/core/mindmap'
import { DEFAULT_TUNING } from '../../../config'
import { createMutationCommit } from '../shared/MutationCommit'
import type { RunMutations } from '../shared/MutationCommit'
import { StateWatchEmitter } from '../shared/StateWatchEmitter'

type ActorOptions = {
  instance: Pick<InternalInstance, 'state' | 'view' | 'document' | 'projection' | 'mutate' | 'emit' | 'config'>
}

const cloneValue = <T,>(value: T): T => {
  const clone = (globalThis as { structuredClone?: <V>(input: V) => V }).structuredClone
  if (typeof clone === 'function') {
    return clone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
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

  private readonly state: ActorOptions['instance']['state']
  private readonly instance: ActorOptions['instance']
  private readonly runMutations: RunMutations
  private readonly layoutEmitter: StateWatchEmitter<MindmapLayoutConfig>

  constructor({ instance }: ActorOptions) {
    this.state = instance.state
    this.instance = instance
    this.runMutations = createMutationCommit(instance.mutate).run
    this.layoutEmitter = new StateWatchEmitter({
      state: this.state,
      keys: ['mindmapLayout'],
      read: () => this.state.read('mindmapLayout'),
      equals: isSameLayout,
      clone: cloneLayout,
      emit: (layout) => {
        instance.emit('mindmap.layout.changed', { layout: cloneLayout(layout) })
      }
    })
  }

  private createInvalidResult = (message: string): DispatchResult => ({
    ok: false,
    reason: 'invalid',
    message
  })

  private readMindmap = (id: string): MindmapTree | undefined =>
    (this.instance.document.get().mindmaps ?? []).find((tree) => tree.id === id)

  private readMindmapNode = (id: string): Node | undefined =>
    this.instance.document.get().nodes.find((node) => node.id === id)

  private createMindmapId = () => {
    const exists = (id: string) => Boolean(this.readMindmap(id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `mindmap_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `mindmap_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private createMindmapNodeId = () => {
    const exists = (id: string) =>
      (this.instance.document.get().mindmaps ?? []).some((tree) => Boolean(tree.nodes[id as MindmapNodeId]))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `mnode_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `mnode_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private cloneTree = (tree: MindmapTree): MindmapTree => cloneValue(tree)

  private cloneNode = (node: Node): Node => cloneValue(node)

  private runMutationsWithValue = async (
    operations: Operation[],
    value?: unknown
  ): Promise<DispatchResult> => {
    const result = await this.runMutations(operations)
    if (!result.ok || typeof value === 'undefined') {
      return result
    }
    return {
      ...result,
      value
    }
  }

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

  private getLayoutHint = (hint?: MindmapLayoutHint) => {
    if (!hint?.nodeSize) return undefined
    if (!hint.anchorId) return undefined
    return hint
  }

  private computeAnchorWorld = (
    tree: MindmapTree,
    hint: MindmapLayoutHint,
    nodePosition: { x: number; y: number }
  ) => {
    const layoutFn = hint.mode === 'tidy' ? layoutMindmapTidy : layoutMindmap
    const layout = layoutFn(tree, () => hint.nodeSize as { width: number; height: number }, hint.options)
    const anchorId = hint.anchorId ?? tree.rootId
    const rect = layout.node[anchorId]
    if (!rect) return undefined
    const shiftX = -layout.bbox.x
    const shiftY = -layout.bbox.y
    return {
      x: nodePosition.x + rect.x + shiftX + rect.width / 2,
      y: nodePosition.y + rect.y + shiftY + rect.height / 2
    }
  }

  private computeAnchorPatch = (
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    hint: MindmapLayoutHint,
    mindmapNode: Node
  ) => {
    const before = this.computeAnchorWorld(beforeTree, hint, mindmapNode.position)
    const after = this.computeAnchorWorld(afterTree, hint, mindmapNode.position)
    if (!before || !after) return undefined
    const dx = before.x - after.x
    const dy = before.y - after.y
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return undefined
    return {
      position: {
        x: mindmapNode.position.x + dx,
        y: mindmapNode.position.y + dy
      }
    }
  }

  private appendAnchorPatch = (
    operations: Operation[],
    mindmapId: string,
    beforeTree: MindmapTree,
    afterTree: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const layoutHint = this.getLayoutHint(layout)
    if (!layoutHint) return operations
    const mindmapNode = this.readMindmapNode(mindmapId)
    if (!mindmapNode) return operations
    const anchorPatch = this.computeAnchorPatch(beforeTree, afterTree, layoutHint, mindmapNode)
    if (!anchorPatch) return operations
    return [
      ...operations,
      {
        type: 'node.update',
        id: mindmapNode.id,
        patch: anchorPatch,
        before: this.cloneNode(mindmapNode)
      }
    ]
  }

  private createReplaceOperations = (
    id: string,
    before: MindmapTree,
    after: MindmapTree,
    layout?: MindmapLayoutHint
  ): Operation[] => {
    const operations: Operation[] = [
      {
        type: 'mindmap.replace',
        id,
        before: this.cloneTree(before),
        after: this.cloneTree(after)
      }
    ]
    return this.appendAnchorPatch(operations, id, before, after, layout)
  }

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

  create: Commands['mindmap']['create'] = (payload) => {
    if (payload?.id && this.readMindmap(payload.id)) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${payload.id} already exists.`))
    }
    const mindmap = createMindmap({
      id: payload?.id ?? this.createMindmapId(),
      rootId: payload?.rootId,
      rootData: payload?.rootData,
      idGenerator: {
        treeId: this.createMindmapId,
        nodeId: this.createMindmapNodeId
      }
    })
    return this.runMutationsWithValue(
      [{ type: 'mindmap.create', mindmap }],
      mindmap.id
    )
  }

  replace: Commands['mindmap']['replace'] = (id, tree) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }
    if (tree.id !== id) {
      return Promise.resolve(this.createInvalidResult('Mindmap id mismatch.'))
    }
    return this.runMutations(
      [{
        type: 'mindmap.replace',
        id,
        before: this.cloneTree(current),
        after: this.cloneTree(tree)
      }]
    )
  }

  delete: Commands['mindmap']['delete'] = (ids) => {
    if (!ids.length) {
      return Promise.resolve(this.createInvalidResult('No mindmap ids provided.'))
    }

    const trees: MindmapTree[] = []
    for (const id of ids) {
      const tree = this.readMindmap(id)
      if (!tree) {
        return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
      }
      trees.push(tree)
    }

    return this.runMutations(
      trees.map((tree) => ({
        type: 'mindmap.delete' as const,
        id: tree.id,
        before: this.cloneTree(tree)
      }))
    )
  }

  addChild: Commands['mindmap']['addChild'] = (id, parentId, payload, options) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = addMindmapChild(current, parentId, payload, {
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: this.createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    const operations = this.createReplaceOperations(id, current, next.tree, options?.layout)
    return this.runMutationsWithValue(operations, next.value?.id)
  }

  addSibling: Commands['mindmap']['addSibling'] = (id, nodeId, position, payload, options) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = addMindmapSibling(current, nodeId, position, payload, {
      idGenerator: {
        nodeId: this.createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    const operations = this.createReplaceOperations(id, current, next.tree, options?.layout)
    return this.runMutationsWithValue(operations, next.value?.id)
  }

  moveSubtree: Commands['mindmap']['moveSubtree'] = (id, nodeId, newParentId, options) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const fromParentId = current.nodes[nodeId]?.parentId
    const fromIndex = fromParentId ? (current.children[fromParentId] ?? []).indexOf(nodeId) : -1
    const requestedIndex = options?.index
    const adjustedIndex =
      typeof requestedIndex === 'number' && fromParentId === newParentId && fromIndex >= 0 && requestedIndex > fromIndex
        ? Math.max(0, requestedIndex - 1)
        : requestedIndex

    const next = moveMindmapSubtree(current, nodeId, newParentId, {
      index: adjustedIndex,
      side: options?.side
    })
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    const operations = this.createReplaceOperations(id, current, next.tree, options?.layout)
    return this.runMutations(operations)
  }

  removeSubtree: Commands['mindmap']['removeSubtree'] = (id, nodeId) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = removeMindmapSubtree(current, nodeId)
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutations(
      this.createReplaceOperations(id, current, next.tree)
    )
  }

  cloneSubtree: Commands['mindmap']['cloneSubtree'] = (id, nodeId, options) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = cloneMindmapSubtree(current, nodeId, {
      parentId: options?.parentId,
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: this.createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutationsWithValue(
      this.createReplaceOperations(id, current, next.tree),
      next.value?.id
    )
  }

  toggleCollapse: Commands['mindmap']['toggleCollapse'] = (id, nodeId, collapsed) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = toggleMindmapCollapse(current, nodeId, collapsed)
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutations(
      this.createReplaceOperations(id, current, next.tree)
    )
  }

  setNodeData: Commands['mindmap']['setNodeData'] = (id, nodeId, patch) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = setMindmapNodeData(current, nodeId, patch)
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutations(
      this.createReplaceOperations(id, current, next.tree)
    )
  }

  reorderChild: Commands['mindmap']['reorderChild'] = (id, parentId, fromIndex, toIndex) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = reorderMindmapChild(current, parentId, fromIndex, toIndex)
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutations(
      this.createReplaceOperations(id, current, next.tree)
    )
  }

  setSide: Commands['mindmap']['setSide'] = (id, nodeId, side) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = setMindmapSide(current, nodeId, side)
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutations(
      this.createReplaceOperations(id, current, next.tree)
    )
  }

  attachExternal: Commands['mindmap']['attachExternal'] = (id, targetId, payload, options) => {
    const current = this.readMindmap(id)
    if (!current) {
      return Promise.resolve(this.createInvalidResult(`Mindmap ${id} not found.`))
    }

    const next = attachMindmapExternal(current, targetId, payload, {
      index: options?.index,
      side: options?.side,
      idGenerator: {
        nodeId: this.createMindmapNodeId
      }
    })
    if (!next.ok) {
      return Promise.resolve(this.createInvalidResult(next.error))
    }

    return this.runMutationsWithValue(
      this.createReplaceOperations(id, current, next.tree),
      next.value?.id
    )
  }

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
    const node = this.instance.projection.getSnapshot().nodes.canvas.find((item) => item.id === nodeId)
    if (!node) return
    if (
      Math.abs(node.position.x - position.x) < threshold &&
      Math.abs(node.position.y - position.y) < threshold
    ) {
      return
    }

    await this.runMutations(
      [{
        type: 'node.update',
        id: nodeId,
        patch: {
          position: { x: position.x, y: position.y }
        }
      }]
    )
  }

  start = () => {
    this.layoutEmitter.start()
  }

  stop = () => {
    this.layoutEmitter.stop()
  }
}
