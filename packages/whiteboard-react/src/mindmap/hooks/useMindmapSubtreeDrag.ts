import { useCallback, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import type { Core, MindmapLayoutOptions, MindmapNodeId, MindmapTree, Node, Point, Rect } from '@whiteboard/core'
import { getSide, getSubtreeIds } from '@whiteboard/core'
import type { MindmapLayoutConfig } from 'types/mindmap'
import type { Size } from 'types/common'

type DropTarget = {
  type: 'attach' | 'reorder'
  parentId: MindmapNodeId
  index: number
  side?: 'left' | 'right'
  targetId?: MindmapNodeId
  connectionLine?: { x1: number; y1: number; x2: number; y2: number }
  insertLine?: { x1: number; y1: number; x2: number; y2: number }
}

type DragPreview = {
  treeId: string
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: DropTarget
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
  core: Core
  getWorldPoint: (event: PointerEvent<HTMLElement>) => Point
  nodeRects: Map<MindmapNodeId, Rect>
}

export const useMindmapSubtreeDrag = ({
  tree,
  mindmapNode,
  nodeSize,
  layout,
  core,
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
      const drop = computeDropTarget({
        tree,
        nodeRects,
        ghost,
        drag,
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
    [getWorldPoint, layout.options, mindmapNode.id, nodeRects, tree]
  )

  const endSubtreeDrag = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const drag = dragRef.current
      if (!drag || drag.pointerId !== event.pointerId) return false
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.releasePointerCapture(event.pointerId)
      const drop = dragPreview?.drop
      if (drop && drop.parentId) {
        const shouldMove =
          drop.parentId !== drag.originParentId || drop.index !== drag.originIndex || drop.side !== undefined
        if (shouldMove) {
          const layoutHint = {
            nodeSize,
            mode: layout.mode,
            options: layout.options,
            anchorId: drop.parentId
          }
          void core.dispatch({
            type: 'mindmap.moveSubtree',
            id: mindmapNode.id,
            nodeId: drag.nodeId,
            newParentId: drop.parentId,
            options: { index: drop.index, side: drop.side, layout: layoutHint }
          })
        }
      }
      dragRef.current = null
      setDragPreview(null)
      return true
    },
    [core, dragPreview?.drop, layout.mode, layout.options, mindmapNode.id, nodeSize]
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

const EDGE_SNAP_THRESHOLD = 24

const getNodeSide = (tree: MindmapTree, nodeId: MindmapNodeId) => getSide(tree, nodeId) ?? 'right'

const getRootSide = (
  options: MindmapLayoutOptions | undefined,
  rootRect: Rect,
  pointer: Point,
  preferred?: 'left' | 'right'
): 'left' | 'right' => {
  const mode = options?.side
  if (mode === 'left' || mode === 'right') return mode
  if (preferred) return preferred
  const centerX = rootRect.x + rootRect.width / 2
  return pointer.x < centerX ? 'left' : 'right'
}

const mapSideIndexToGlobalIndex = (
  tree: MindmapTree,
  children: MindmapNodeId[],
  side: 'left' | 'right',
  sideIndex: number
) => {
  const sideChildren = children.filter((id) => getNodeSide(tree, id) === side)
  if (sideChildren.length === 0) return children.length
  if (sideIndex <= 0) return children.indexOf(sideChildren[0])
  if (sideIndex >= sideChildren.length) {
    return children.indexOf(sideChildren[sideChildren.length - 1]) + 1
  }
  return children.indexOf(sideChildren[sideIndex])
}

const computeEdgeAlignment = (ghost: Rect, target: Rect) => {
  const ghostCenterX = ghost.x + ghost.width / 2
  const ghostCenterY = ghost.y + ghost.height / 2
  const targetCenterX = target.x + target.width / 2
  const targetCenterY = target.y + target.height / 2
  const dx = ghostCenterX - targetCenterX
  const dy = ghostCenterY - targetCenterY
  const horizontal = Math.abs(dx) >= Math.abs(dy)
  if (horizontal) {
    const gap = Math.max(0, Math.abs(dx) - (ghost.width + target.width) / 2)
    if (dx >= 0) {
      return {
        key: 'left-to-right' as const,
        value: gap,
        line: {
          x1: ghost.x,
          y1: ghostCenterY,
          x2: target.x + target.width,
          y2: targetCenterY
        }
      }
    }
    return {
      key: 'right-to-left' as const,
      value: gap,
      line: {
        x1: ghost.x + ghost.width,
        y1: ghostCenterY,
        x2: target.x,
        y2: targetCenterY
      }
    }
  }
  const gap = Math.max(0, Math.abs(dy) - (ghost.height + target.height) / 2)
  if (dy >= 0) {
    return {
      key: 'top-to-bottom' as const,
      value: gap,
      line: {
        x1: ghostCenterX,
        y1: ghost.y,
        x2: targetCenterX,
        y2: target.y + target.height
      }
    }
  }
  return {
    key: 'bottom-to-top' as const,
    value: gap,
    line: {
      x1: ghostCenterX,
      y1: ghost.y + ghost.height,
      x2: targetCenterX,
      y2: target.y
    }
  }
}

const computeDropTarget = ({
  tree,
  nodeRects,
  ghost,
  drag,
  layoutOptions
}: {
  tree: MindmapTree
  nodeRects: Map<MindmapNodeId, Rect>
  ghost: Rect
  drag: DragRef
  layoutOptions?: MindmapLayoutOptions
}): DropTarget | undefined => {
  let hoveredId: MindmapNodeId | undefined
  let hoveredRect: Rect | undefined
  let hoveredAlign: ReturnType<typeof computeEdgeAlignment> | undefined
  let hoveredDistance = Number.POSITIVE_INFINITY
  nodeRects.forEach((rect, id) => {
    if (drag.excludeIds.has(id)) return
    const alignment = computeEdgeAlignment(ghost, rect)
    if (alignment.value < hoveredDistance) {
      hoveredDistance = alignment.value
      hoveredId = id
      hoveredRect = rect
      hoveredAlign = alignment
    }
  })
  if (!hoveredId || !hoveredRect || !hoveredAlign) return
  if (hoveredDistance > EDGE_SNAP_THRESHOLD) return
  const rootRect = nodeRects.get(tree.rootId)
  if (!rootRect) return
  const ghostCenter = { x: ghost.x + ghost.width / 2, y: ghost.y + ghost.height / 2 }
  const isHorizontal = hoveredAlign.key === 'left-to-right' || hoveredAlign.key === 'right-to-left'
  const isAttach = hoveredId === tree.rootId || isHorizontal

  if (isAttach) {
    const parentId = hoveredId
    const filteredChildren =
      parentId === drag.originParentId
        ? (tree.children[parentId] ?? []).filter((id) => id !== drag.nodeId)
        : (tree.children[parentId] ?? [])
    const side = parentId === tree.rootId ? getRootSide(layoutOptions, rootRect, ghostCenter) : undefined
    const index =
      parentId === tree.rootId && side
        ? mapSideIndexToGlobalIndex(tree, filteredChildren, side, filteredChildren.length)
        : filteredChildren.length
    const connectionLine = hoveredAlign.line
    return {
      type: 'attach',
      parentId,
      index,
      side,
      targetId: hoveredId,
      connectionLine
    }
  }

  const parentId = tree.nodes[hoveredId]?.parentId
  if (!parentId) return
  const filteredChildren =
    parentId === drag.originParentId
      ? (tree.children[parentId] ?? []).filter((id) => id !== drag.nodeId)
      : (tree.children[parentId] ?? [])
  const targetIndex = filteredChildren.indexOf(hoveredId)
  if (targetIndex < 0) return
  const before = ghostCenter.y < hoveredRect.y + hoveredRect.height / 2
  const side =
    parentId === tree.rootId
      ? getRootSide(layoutOptions, rootRect, ghostCenter, tree.nodes[hoveredId]?.side)
      : undefined
  const index =
    parentId === tree.rootId && side
      ? mapSideIndexToGlobalIndex(tree, filteredChildren, side, before ? targetIndex : targetIndex + 1)
      : before
        ? targetIndex
        : targetIndex + 1
  const lineY = before ? hoveredRect.y - 6 : hoveredRect.y + hoveredRect.height + 6
  return {
    type: 'reorder',
    parentId,
    index,
    side,
    targetId: hoveredId,
    insertLine: {
      x1: hoveredRect.x - 12,
      y1: lineY,
      x2: hoveredRect.x + hoveredRect.width + 12,
      y2: lineY
    }
  }
}
