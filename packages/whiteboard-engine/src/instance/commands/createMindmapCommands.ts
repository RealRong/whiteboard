import {
  getSubtreeIds,
  getSide,
  type MindmapNodeId
} from '@whiteboard/core'
import type {
  NodeId,
  Point
} from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance, WhiteboardMindmapViewTree } from '@engine-types/instance'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'

export const createMindmapCommands = (
  instance: WhiteboardInstance
): Pick<WhiteboardCommands, 'mindmap'> => {
  const { core } = instance.runtime
  const { read, write } = instance.state
  const mindmapCommands = core.commands.mindmap
  const mindmapDragService = instance.runtime.services.mindmapDrag

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

  const insertMindmapNode: WhiteboardCommands['mindmap']['insertNode'] = async ({
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
      await mindmapCommands.addChild(id, targetNodeId, payload, { index, side, layout: layoutHint })
      return
    }

    if (placement === 'up' || placement === 'down') {
      await mindmapCommands.addSibling(id, targetNodeId, placement === 'up' ? 'before' : 'after', payload, {
        layout: layoutHint
      })
      return
    }

    const targetSide = getSide(tree, targetNodeId) ?? 'right'
    const towardRoot =
      (placement === 'left' && targetSide === 'right') || (placement === 'right' && targetSide === 'left')

    if (towardRoot) {
      const result = await mindmapCommands.addSibling(id, targetNodeId, 'before', payload, {
        layout: layoutHint
      })
      if (!result.ok || !result.value) return
      await mindmapCommands.moveSubtree(id, targetNodeId, result.value as MindmapNodeId, {
        index: 0,
        layout: toLayoutHint(result.value as MindmapNodeId, nodeSize, layout)
      })
      return
    }

    await mindmapCommands.addChild(id, targetNodeId, payload, { layout: layoutHint })
  }

  const moveSubtreeWithLayout: WhiteboardCommands['mindmap']['moveSubtreeWithLayout'] = ({
    id,
    nodeId,
    newParentId,
    index,
    side,
    nodeSize,
    layout
  }) =>
    mindmapCommands.moveSubtree(id, nodeId, newParentId, {
      index,
      side,
      layout: toLayoutHint(newParentId, nodeSize, layout)
    })

  const moveSubtreeWithDrop: WhiteboardCommands['mindmap']['moveSubtreeWithDrop'] = async ({
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

  const moveMindmapRoot: WhiteboardCommands['mindmap']['moveRoot'] = async ({ nodeId, position, threshold = 0.5 }) => {
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

  const getWorldPointFromClient = (clientX: number, clientY: number): Point => {
    const screen = instance.runtime.viewport.clientToScreen(clientX, clientY)
    return instance.runtime.viewport.screenToWorld(screen)
  }

  const getMindmapTreeView = (treeId: NodeId): WhiteboardMindmapViewTree | undefined =>
    instance.view.read('mindmap.trees').find((item) => item.id === treeId)

  const getMindmapNodeRects = (item: WhiteboardMindmapViewTree, baseOffset = item.node.position) =>
    mindmapDragService.buildNodeRectMap({
      nodeRects: item.computed.node,
      shift: {
        x: item.shiftX,
        y: item.shiftY
      },
      offset: baseOffset
    })

  const startMindmapDrag: WhiteboardCommands['mindmap']['startDrag'] = ({
    treeId,
    nodeId,
    pointerId,
    clientX,
    clientY
  }) => {
    if (read('mindmapDrag').active) return false

    const treeItem = getMindmapTreeView(treeId)
    if (!treeItem) return false

    const world = getWorldPointFromClient(clientX, clientY)
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

    const nodeRects = getMindmapNodeRects(treeItem)
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

  const updateMindmapDrag: WhiteboardCommands['mindmap']['updateDrag'] = ({ pointerId, clientX, clientY }) => {
    const active = read('mindmapDrag').active
    if (!active || active.pointerId !== pointerId) return false

    const world = getWorldPointFromClient(clientX, clientY)

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
      return true
    }

    const ghost = mindmapDragService.buildSubtreeGhostRect({
      pointerWorld: world,
      pointerOffset: active.offset,
      nodeRect: active.rect
    })

    let drop = active.drop
    const treeItem = getMindmapTreeView(active.treeId)
    if (treeItem) {
      const nodeRects = getMindmapNodeRects(treeItem, active.baseOffset)
      drop = mindmapDragService.computeSubtreeDropTarget({
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
    return true
  }

  const endMindmapDrag: WhiteboardCommands['mindmap']['endDrag'] = ({ pointerId }) => {
    const active = read('mindmapDrag').active
    if (!active || active.pointerId !== pointerId) return false

    write('mindmapDrag', {})

    if (active.kind === 'root') {
      void moveMindmapRoot({
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

  const cancelMindmapDrag: WhiteboardCommands['mindmap']['cancelDrag'] = (options) => {
    const active = read('mindmapDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false
    write('mindmapDrag', {})
    return true
  }

  return {
    mindmap: {
      ...mindmapCommands,
      insertNode: insertMindmapNode,
      moveSubtreeWithLayout,
      moveSubtreeWithDrop,
      moveRoot: moveMindmapRoot,
      startDrag: startMindmapDrag,
      updateDrag: updateMindmapDrag,
      endDrag: endMindmapDrag,
      cancelDrag: cancelMindmapDrag
    }
  }
}
