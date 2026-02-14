import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { MindmapNodeId, MindmapTree, Node, Point, Rect } from '@whiteboard/core'
import { getSubtreeIds } from '@whiteboard/core'
import type { MindmapDragService, MindmapSubtreeDropTarget, WhiteboardCommands } from '@whiteboard/engine'
import type { MindmapLayoutConfig } from 'types/mindmap'
import type { Size } from 'types/common'

type DragPreview = {
  treeId: string
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapSubtreeDropTarget
}

type DragRef = {
  pointerId: number
  nodeId: MindmapNodeId
  originParentId?: MindmapNodeId
  originIndex?: number
  offset: Point
  rect: Rect
  excludeIds: Set<MindmapNodeId>
}

type UseMindmapSubtreeDragOptions = {
  tree: MindmapTree
  mindmapNode: Node
  nodeSize: Size
  layout: MindmapLayoutConfig
  moveSubtreeWithDrop: WhiteboardCommands['mindmap']['moveSubtreeWithDrop']
  computeSubtreeDropTarget: MindmapDragService['computeSubtreeDropTarget']
  getWorldPoint: (event: PointerEvent<HTMLElement>) => Point
  nodeRects: Map<MindmapNodeId, Rect>
}

export const useMindmapSubtreeDrag = ({
  tree,
  mindmapNode,
  nodeSize,
  layout,
  moveSubtreeWithDrop,
  computeSubtreeDropTarget,
  getWorldPoint,
  nodeRects
}: UseMindmapSubtreeDragOptions) => {
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null)
  const dragRef = useRef<DragRef | null>(null)

  const startSubtreeDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>, nodeId: MindmapNodeId, rect: Rect) => {
      const world = getWorldPoint(event)
      const offsetPoint = { x: world.x - rect.x, y: world.y - rect.y }
      const originParentId = tree.nodes[nodeId]?.parentId
      const originIndex = originParentId ? (tree.children[originParentId] ?? []).indexOf(nodeId) : undefined
      dragRef.current = {
        pointerId: event.pointerId,
        nodeId,
        originParentId,
        originIndex,
        offset: offsetPoint,
        rect,
        excludeIds: new Set(getSubtreeIds(tree, nodeId))
      }
      setDragPreview({
        treeId: mindmapNode.id,
        nodeId,
        ghost: rect
      })
    },
    [getWorldPoint, mindmapNode.id, tree]
  )

  const updateSubtreeDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return false

      event.preventDefault()
      const world = getWorldPoint(event)
      const ghost = {
        x: world.x - drag.offset.x,
        y: world.y - drag.offset.y,
        width: drag.rect.width,
        height: drag.rect.height
      }

      const drop = computeSubtreeDropTarget({
        tree,
        nodeRects,
        ghost,
        dragNodeId: drag.nodeId,
        dragExcludeIds: drag.excludeIds,
        layoutOptions: layout.options
      })

      setDragPreview({
        treeId: mindmapNode.id,
        nodeId: drag.nodeId,
        ghost,
        drop
      })
      return true
    },
    [computeSubtreeDropTarget, getWorldPoint, layout.options, mindmapNode.id, nodeRects, tree]
  )

  const endSubtreeDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return false

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.releasePointerCapture(event.pointerId)

      const drop = dragPreview?.drop
      if (drop) {
        void moveSubtreeWithDrop({
          id: mindmapNode.id,
          nodeId: drag.nodeId,
          drop: {
            parentId: drop.parentId,
            index: drop.index,
            side: drop.side
          },
          origin: {
            parentId: drag.originParentId,
            index: drag.originIndex
          },
          nodeSize,
          layout
        })
      }

      dragRef.current = null
      setDragPreview(null)
      return true
    },
    [dragPreview?.drop, layout, mindmapNode.id, moveSubtreeWithDrop, nodeSize]
  )

  const cancelSubtreeDrag = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return false
    event.preventDefault()
    dragRef.current = null
    setDragPreview(null)
    return true
  }, [])

  return {
    dragPreview,
    startSubtreeDrag,
    updateSubtreeDrag,
    endSubtreeDrag,
    cancelSubtreeDrag
  }
}
