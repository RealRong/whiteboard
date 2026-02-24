import { computeSubtreeDropTarget, getSubtreeIds } from '@whiteboard/core/mindmap'
import type { MindmapNodeId, NodeId, Rect } from '@whiteboard/core/types'
import type { MindmapMoveDropOptions, MindmapMoveRootOptions } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapViewTree } from '@engine-types/instance/view'
import type { MindmapRootDragState, MindmapSubtreeDragState } from '@engine-types/state'
import { DEFAULT_TUNING } from '../../../config'

type DragInstance = Pick<InternalInstance, 'state' | 'view' | 'config'>

type MindmapCommands = {
  moveRoot: (options: MindmapMoveRootOptions) => Promise<void>
  moveSubtreeWithDrop: (options: MindmapMoveDropOptions) => Promise<void>
}

type DragOptions = {
  instance: DragInstance
  mindmap: MindmapCommands
}

export class Drag {
  private readonly instance: DragInstance
  private readonly mindmap: MindmapCommands
  private session: MindmapRootDragState | MindmapSubtreeDragState | null = null

  constructor({ instance, mindmap }: DragOptions) {
    this.instance = instance
    this.mindmap = mindmap
  }

  private setInteractionSession = (pointerId?: number) => {
    this.instance.state.write('interactionSession', (prev) => {
      if (pointerId !== undefined) {
        if (
          prev.active?.kind === 'mindmapDrag'
          && prev.active.pointerId === pointerId
        ) {
          return prev
        }
        return {
          active: {
            kind: 'mindmapDrag',
            pointerId
          }
        }
      }
      if (prev.active?.kind !== 'mindmapDrag') return prev
      return {}
    })
  }

  private getTreeView = (treeId: NodeId): MindmapViewTree | undefined => {
    return this.instance.view.getState().mindmap.byId.get(treeId)
  }

  private buildNodeRectMap = (options: {
    nodeRects: Partial<Record<MindmapNodeId, Rect>>
    shift: { x: number; y: number }
    offset: { x: number; y: number }
  }) => {
    const { nodeRects, shift, offset } = options
    const rectMap = new Map<MindmapNodeId, Rect>()
    Object.entries(nodeRects).forEach(([id, rect]) => {
      if (!rect) return
      rectMap.set(id as MindmapNodeId, {
        x: rect.x + shift.x + offset.x,
        y: rect.y + shift.y + offset.y,
        width: rect.width,
        height: rect.height
      })
    })
    return rectMap
  }

  private buildSubtreeGhostRect = (options: {
    pointerWorld: { x: number; y: number }
    pointerOffset: { x: number; y: number }
    nodeRect: Rect
  }): Rect => {
    const { pointerWorld, pointerOffset, nodeRect } = options
    return {
      x: pointerWorld.x - pointerOffset.x,
      y: pointerWorld.y - pointerOffset.y,
      width: nodeRect.width,
      height: nodeRect.height
    }
  }

  private getNodeRects = (item: MindmapViewTree, baseOffset = item.node.position) => {
    return this.buildNodeRectMap({
      nodeRects: item.computed.node,
      shift: {
        x: item.shiftX,
        y: item.shiftY
      },
      offset: baseOffset
    })
  }

  private readActive = (pointerId?: number) => {
    const session = this.instance.state.read('interactionSession').active
    if (!session || session.kind !== 'mindmapDrag') return undefined
    if (pointerId !== undefined && session.pointerId !== pointerId) return undefined

    const active = this.session
    if (!active) return undefined
    if (active.pointerId !== session.pointerId) return undefined
    return active
  }

  start = ({ treeId, nodeId, pointer }: { treeId: NodeId; nodeId: NodeId; pointer: { pointerId: number; world: { x: number; y: number } } }) => {
    const { state } = this.instance
    if (state.read('interactionSession').active) return false

    const treeItem = this.getTreeView(treeId)
    if (!treeItem) return false

    const world = pointer.world
    const baseOffset = {
      x: treeItem.node.position.x,
      y: treeItem.node.position.y
    }

    if (nodeId === treeItem.tree.rootId) {
      const payload: MindmapRootDragState = {
        kind: 'root',
        treeId,
        pointerId: pointer.pointerId,
        start: world,
        origin: baseOffset,
        position: baseOffset
      }
      this.session = payload
      state.write('mindmapDrag', {
        payload
      })
      this.setInteractionSession(pointer.pointerId)
      return true
    }

    const nodeRects = this.getNodeRects(treeItem)
    const rect = nodeRects.get(nodeId)
    if (!rect) return false

    const originParentId = treeItem.tree.nodes[nodeId]?.parentId
    const originIndex =
      originParentId !== undefined
        ? (treeItem.tree.children[originParentId] ?? []).indexOf(nodeId)
        : undefined

    const payload: MindmapSubtreeDragState = {
      kind: 'subtree',
      treeId,
      pointerId: pointer.pointerId,
      nodeId,
      originParentId,
      originIndex,
      baseOffset,
      offset: {
        x: world.x - rect.x,
        y: world.y - rect.y
      },
      rect,
      ghost: rect,
      excludeIds: getSubtreeIds(treeItem.tree, nodeId)
    }
    this.session = payload
    state.write('mindmapDrag', { payload })
    this.setInteractionSession(pointer.pointerId)
    return true
  }

  update = ({ pointer }: { pointer: { pointerId: number; world: { x: number; y: number } } }) => {
    const { state } = this.instance
    const active = this.readActive(pointer.pointerId)
    if (!active) return false

    state.batchFrame(() => {
      const world = pointer.world

      if (active.kind === 'root') {
        const nextPosition = {
          x: active.origin.x + (world.x - active.start.x),
          y: active.origin.y + (world.y - active.start.y)
        }
        this.session = {
          ...active,
          position: nextPosition
        }
        state.write('mindmapDrag', {
          payload: this.session
        })
        return
      }

      const ghost = this.buildSubtreeGhostRect({
        pointerWorld: world,
        pointerOffset: active.offset,
        nodeRect: active.rect
      })

      let drop = active.drop
      const treeItem = this.getTreeView(active.treeId)
      if (treeItem) {
        const nodeRects = this.getNodeRects(treeItem, active.baseOffset)
        drop = computeSubtreeDropTarget({
          tree: treeItem.tree,
          nodeRects,
          ghost,
          dragNodeId: active.nodeId,
          dragExcludeIds: new Set(active.excludeIds),
          layoutOptions: (state.read('mindmapLayout') ?? treeItem.layout).options,
          snapThreshold: DEFAULT_TUNING.mindmap.dropSnapThreshold,
          defaultSide: DEFAULT_TUNING.mindmap.defaultSide,
          reorderLineGap: DEFAULT_TUNING.mindmap.reorderLineGap,
          reorderLineOverflow: DEFAULT_TUNING.mindmap.reorderLineOverflow
        })
      }

      this.session = {
        ...active,
        ghost,
        drop
      }
      state.write('mindmapDrag', {
        payload: this.session
      })
    })
    return true
  }

  end = ({ pointer }: { pointer: { pointerId: number } }) => {
    const { state, config } = this.instance
    const active = this.readActive(pointer.pointerId)
    if (!active) return false

    this.session = null
    state.write('mindmapDrag', {})
    this.setInteractionSession(undefined)

    if (active.kind === 'root') {
      void this.mindmap.moveRoot({
        nodeId: active.treeId,
        position: active.position
      })
      return true
    }

    if (active.drop) {
      void this.mindmap.moveSubtreeWithDrop({
        id: active.treeId,
        nodeId: active.nodeId,
        drop: {
          parentId: active.drop.parentId,
          index: active.drop.index,
          side: active.drop.side
        },
        origin: {
          parentId: active.originParentId,
          index: active.originIndex
        },
        nodeSize: config.mindmapNodeSize,
        layout: state.read('mindmapLayout') ?? {}
      })
    }

    return true
  }

  cancel = (options?: { pointer?: { pointerId: number } }) => {
    const active = this.readActive(options?.pointer?.pointerId)
    if (!active) return false
    if (options?.pointer && active.pointerId !== options.pointer.pointerId) return false
    this.session = null
    this.instance.state.write('mindmapDrag', {})
    this.setInteractionSession(undefined)
    return true
  }
}
