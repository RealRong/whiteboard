import { getSide, type MindmapNodeId, type MindmapTree } from '@whiteboard/core'
import type { MindmapLayoutOptions, Rect } from '@whiteboard/core'
import type { MindmapDragDropTarget } from '@engine-types/state'
import { DEFAULT_TUNING } from '../../../../config'

type ComputeEdgeAlignmentResult = {
  key: 'left-to-right' | 'right-to-left' | 'top-to-bottom' | 'bottom-to-top'
  value: number
  line: {
    x1: number
    y1: number
    x2: number
    y2: number
  }
}

export type SubtreeDropOptions = {
  tree: MindmapTree
  nodeRects: Map<MindmapNodeId, Rect>
  ghost: Rect
  dragNodeId: MindmapNodeId
  dragExcludeIds: Set<MindmapNodeId>
  layoutOptions?: MindmapLayoutOptions
  snapThreshold?: number
}

const getNodeSide = (tree: MindmapTree, nodeId: MindmapNodeId) =>
  getSide(tree, nodeId) ?? DEFAULT_TUNING.mindmap.defaultSide

const getRootSide = (
  options: MindmapLayoutOptions | undefined,
  rootRect: Rect,
  pointer: { x: number; y: number },
  preferred?: 'left' | 'right'
): 'left' | 'right' => {
  const mode = options?.side
  if (mode === 'left' || mode === 'right') return mode
  if (preferred) return preferred
  const centerX = rootRect.x + rootRect.width / 2
  return pointer.x < centerX ? 'left' : DEFAULT_TUNING.mindmap.defaultSide
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

const computeEdgeAlignment = (ghost: Rect, target: Rect): ComputeEdgeAlignmentResult => {
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
        key: 'left-to-right',
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
      key: 'right-to-left',
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
      key: 'top-to-bottom',
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
    key: 'bottom-to-top',
    value: gap,
    line: {
      x1: ghostCenterX,
      y1: ghost.y + ghost.height,
      x2: targetCenterX,
      y2: target.y
    }
  }
}

export const computeSubtreeDropTarget = ({
  tree,
  nodeRects,
  ghost,
  dragNodeId,
  dragExcludeIds,
  layoutOptions,
  snapThreshold = DEFAULT_TUNING.mindmap.dropSnapThreshold
}: SubtreeDropOptions): MindmapDragDropTarget | undefined => {
  let hoveredId: MindmapNodeId | undefined
  let hoveredRect: Rect | undefined
  let hoveredAlign: ComputeEdgeAlignmentResult | undefined
  let hoveredDistance = Number.POSITIVE_INFINITY

  nodeRects.forEach((rect, id) => {
    if (dragExcludeIds.has(id)) return
    const alignment = computeEdgeAlignment(ghost, rect)
    if (alignment.value < hoveredDistance) {
      hoveredDistance = alignment.value
      hoveredId = id
      hoveredRect = rect
      hoveredAlign = alignment
    }
  })

  if (!hoveredId || !hoveredRect || !hoveredAlign) return undefined
  if (hoveredDistance > snapThreshold) return undefined

  const rootRect = nodeRects.get(tree.rootId)
  if (!rootRect) return undefined

  const ghostCenter = { x: ghost.x + ghost.width / 2, y: ghost.y + ghost.height / 2 }
  const isHorizontal = hoveredAlign.key === 'left-to-right' || hoveredAlign.key === 'right-to-left'
  const isAttach = hoveredId === tree.rootId || isHorizontal

  if (isAttach) {
    const parentId = hoveredId
    const children = (tree.children[parentId] ?? []).filter((id) => id !== dragNodeId)
    const side = parentId === tree.rootId ? getRootSide(layoutOptions, rootRect, ghostCenter) : undefined
    const index =
      parentId === tree.rootId && side
        ? mapSideIndexToGlobalIndex(tree, children, side, children.length)
        : children.length

    return {
      type: 'attach',
      parentId,
      index,
      side,
      targetId: hoveredId,
      connectionLine: hoveredAlign.line
    }
  }

  const parentId = tree.nodes[hoveredId]?.parentId
  if (!parentId) return undefined

  const filteredChildren = (tree.children[parentId] ?? []).filter((id) => id !== dragNodeId)
  const targetIndex = filteredChildren.indexOf(hoveredId)
  if (targetIndex < 0) return undefined

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

  const lineY = before
    ? hoveredRect.y - DEFAULT_TUNING.mindmap.reorderLineGap
    : hoveredRect.y + hoveredRect.height + DEFAULT_TUNING.mindmap.reorderLineGap

  return {
    type: 'reorder',
    parentId,
    index,
    side,
    targetId: hoveredId,
    insertLine: {
      x1: hoveredRect.x - DEFAULT_TUNING.mindmap.reorderLineOverflow,
      y1: lineY,
      x2: hoveredRect.x + hoveredRect.width + DEFAULT_TUNING.mindmap.reorderLineOverflow,
      y2: lineY
    }
  }
}
