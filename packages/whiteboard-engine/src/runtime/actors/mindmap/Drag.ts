import { computeSubtreeDropTarget, getSubtreeIds } from '@whiteboard/core'
import type { MindmapNodeId, NodeId, Rect } from '@whiteboard/core'
import type { MindmapMoveDropOptions, MindmapMoveRootOptions } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapViewTree } from '@engine-types/instance/view'
import { DEFAULT_TUNING } from '../../../config'

type DragInstance = Pick<InternalInstance, 'state' | 'view' | 'runtime'>

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

  constructor({ instance, mindmap }: DragOptions) {
    this.instance = instance
    this.mindmap = mindmap
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

  start = ({ treeId, nodeId, pointer }: { treeId: NodeId; nodeId: NodeId; pointer: { pointerId: number; world: { x: number; y: number } } }) => {
    const { state } = this.instance
    if (state.read('mindmapDrag').active) return false

    const treeItem = this.getTreeView(treeId)
    if (!treeItem) return false

    const world = pointer.world
    const baseOffset = {
      x: treeItem.node.position.x,
      y: treeItem.node.position.y
    }

    if (nodeId === treeItem.tree.rootId) {
      state.write('mindmapDrag', {
        active: {
          kind: 'root',
          treeId,
          pointerId: pointer.pointerId,
          start: world,
          origin: baseOffset,
          position: baseOffset
        }
      })
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

    state.write('mindmapDrag', {
      active: {
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
    })
    return true
  }

  update = ({ pointer }: { pointer: { pointerId: number; world: { x: number; y: number } } }) => {
    const { state } = this.instance
    const active = state.read('mindmapDrag').active
    if (!active || active.pointerId !== pointer.pointerId) return false

    state.batchFrame(() => {
      const world = pointer.world

      if (active.kind === 'root') {
        const nextPosition = {
          x: active.origin.x + (world.x - active.start.x),
          y: active.origin.y + (world.y - active.start.y)
        }
        state.write('mindmapDrag', {
          active: {
            ...active,
            position: nextPosition
          }
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

      state.write('mindmapDrag', {
        active: {
          ...active,
          ghost,
          drop
        }
      })
    })
    return true
  }

  end = ({ pointer }: { pointer: { pointerId: number } }) => {
    const { state, runtime } = this.instance
    const active = state.read('mindmapDrag').active
    if (!active || active.pointerId !== pointer.pointerId) return false

    state.write('mindmapDrag', {})

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
        nodeSize: runtime.config.mindmapNodeSize,
        layout: state.read('mindmapLayout') ?? {}
      })
    }

    return true
  }

  cancel = (options?: { pointer?: { pointerId: number } }) => {
    const active = this.instance.state.read('mindmapDrag').active
    if (!active) return false
    if (options?.pointer && active.pointerId !== options.pointer.pointerId) return false
    this.instance.state.write('mindmapDrag', {})
    return true
  }
}
