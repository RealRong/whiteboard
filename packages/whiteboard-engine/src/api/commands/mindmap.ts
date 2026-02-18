import {
  getSubtreeIds,
  getSide,
  type MindmapNodeId
} from '@whiteboard/core'
import type {
  NodeId,
  Point
} from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { MindmapViewTree } from '@engine-types/instance/view'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'

export const createMindmap = (
  instance: InternalInstance
): Pick<Commands, 'mindmap'> => {
  const { core } = instance.runtime
  const { read, write, batchFrame } = instance.state
  const coreMindmap = core.commands.mindmap
  const mindmapDrag = instance.runtime.services.mindmapDrag

  const toLayoutHint = (
    anchorId: MindmapNodeId,
    nodeSize: { width: number; height: number },
    layout: MindmapLayoutConfig
  ) => ({
    nodeSize,
    mode: layout.mode,
    options: layout.options,
    anchorId
  })

  const resolveRootInsertSide = (
    placement: 'left' | 'right' | 'up' | 'down',
    layout: MindmapLayoutConfig
  ): 'left' | 'right' => {
    if (placement === 'left') return 'left'
    if (placement === 'right') return 'right'
    const layoutSide = layout.options?.side
    return layoutSide === 'left' || layoutSide === 'right' ? layoutSide : 'right'
  }

  const insertNode: Commands['mindmap']['insertNode'] = async ({
    id,
    tree,
    targetNodeId,
    placement,
    nodeSize,
    layout,
    payload = { kind: 'text', text: '' }
  }) => {
    const layoutHint = toLayoutHint(targetNodeId, nodeSize, layout)

    if (targetNodeId === tree.rootId) {
      const children = tree.children[targetNodeId] ?? []
      const index = placement === 'up' ? 0 : placement === 'down' ? children.length : undefined
      const side = resolveRootInsertSide(placement, layout)
      await coreMindmap.addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await coreMindmap.addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getSide(tree, targetNodeId) ?? 'right'
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await coreMindmap.addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return
      await coreMindmap.moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await coreMindmap.addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  const moveSubtreeWithLayout: Commands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    coreMindmap.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveSubtreeWithDrop: Commands['mindmap']['moveSubtreeWithDrop'] = async ({
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

    await moveSubtreeWithLayout({
      id,
      nodeId,
      newParentId: drop.parentId,
      index: drop.index,
      side: drop.side,
      nodeSize,
      layout
    })
  }

  const moveRoot: Commands['mindmap']['moveRoot'] = async ({ nodeId, position, threshold = 0.5 }) => {
    const node = read('canvasNodes').find((item) => item.id === nodeId)
    if (!node) return
    if (Math.abs(node.position.x - position.x) < threshold && Math.abs(node.position.y - position.y) < threshold) {
      return
    }

    await core.dispatch({
      type: 'node.update',
      id: nodeId,
      patch: {
        position: { x: position.x, y: position.y }
      }
    })
  }

  const getTreeView = (treeId: NodeId): MindmapViewTree | undefined =>
    instance.view.mindmap.tree(treeId)

  const getNodeRects = (item: MindmapViewTree, baseOffset = item.node.position) =>
    mindmapDrag.buildNodeRectMap({
      nodeRects: item.computed.node,
      shift: {
        x: item.shiftX,
        y: item.shiftY
      },
      offset: baseOffset
    })

  const startDrag: Commands['mindmap']['startDrag'] = ({
    treeId,
    nodeId,
    pointerId,
    clientX,
    clientY
  }) => {
    if (read('mindmapDrag').active) return false

    const treeItem = getTreeView(treeId)
    if (!treeItem) return false

    const world = instance.runtime.viewport.clientToWorld(clientX, clientY)
    const baseOffset = {
      x: treeItem.node.position.x,
      y: treeItem.node.position.y
    }

    if (nodeId === treeItem.tree.rootId) {
      write('mindmapDrag', {
        active: {
          kind: 'root',
          treeId,
          pointerId,
          start: world,
          origin: baseOffset,
          position: baseOffset
        }
      })
      return true
    }

    const nodeRects = getNodeRects(treeItem)
    const rect = nodeRects.get(nodeId)
    if (!rect) return false

    const originParentId = treeItem.tree.nodes[nodeId]?.parentId
    const originIndex =
      originParentId !== undefined ? (treeItem.tree.children[originParentId] ?? []).indexOf(nodeId) : undefined

    write('mindmapDrag', {
      active: {
        kind: 'subtree',
        treeId,
        pointerId,
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

  const updateDrag: Commands['mindmap']['updateDrag'] = ({ pointerId, clientX, clientY }) => {
    const active = read('mindmapDrag').active
    if (!active || active.pointerId !== pointerId) return false

    batchFrame(() => {
      const world = instance.runtime.viewport.clientToWorld(clientX, clientY)

      if (active.kind === 'root') {
        const nextPosition = {
          x: active.origin.x + (world.x - active.start.x),
          y: active.origin.y + (world.y - active.start.y)
        }
        write('mindmapDrag', {
          active: {
            ...active,
            position: nextPosition
          }
        })
        return
      }

      const ghost = mindmapDrag.buildSubtreeGhostRect({
        pointerWorld: world,
        pointerOffset: active.offset,
        nodeRect: active.rect
      })

      let drop = active.drop
      const treeItem = getTreeView(active.treeId)
      if (treeItem) {
        const nodeRects = getNodeRects(treeItem, active.baseOffset)
        drop = mindmapDrag.computeSubtreeDropTarget({
          tree: treeItem.tree,
          nodeRects,
          ghost,
          dragNodeId: active.nodeId,
          dragExcludeIds: new Set(active.excludeIds),
          layoutOptions: (read('mindmapLayout') ?? treeItem.layout).options
        })
      }

      write('mindmapDrag', {
        active: {
          ...active,
          ghost,
          drop
        }
      })
    })
    return true
  }

  const endDrag: Commands['mindmap']['endDrag'] = ({ pointerId }) => {
    const active = read('mindmapDrag').active
    if (!active || active.pointerId !== pointerId) return false

    write('mindmapDrag', {})

    if (active.kind === 'root') {
      void moveRoot({
        nodeId: active.treeId,
        position: active.position
      })
      return true
    }

    if (active.drop) {
      void moveSubtreeWithDrop({
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
        nodeSize: instance.runtime.config.mindmapNodeSize,
        layout: read('mindmapLayout') ?? {}
      })
    }

    return true
  }

  const cancelDrag: Commands['mindmap']['cancelDrag'] = (options) => {
    const active = read('mindmapDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false
    write('mindmapDrag', {})
    return true
  }

  return {
    mindmap: {
      ...coreMindmap,
      insertNode,
      moveSubtreeWithLayout,
      moveSubtreeWithDrop,
      moveRoot,
      startDrag,
      updateDrag,
      endDrag,
      cancelDrag
    }
  }
}
