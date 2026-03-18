import type { BoardConfig } from '@whiteboard/core/config'
import {
  computeNextRotation,
  computeResizeRect,
  computeResizeSnap,
  expandRectByThreshold,
  getResizeSourceEdges,
  resolveInteractionZoom,
  resolveSnapThresholdWorld,
  type Guide,
  type ResizeDirection,
  type SnapCandidate
} from '@whiteboard/core/node'
import {
  getNodeAABB,
  getRectCenter,
  isPointEqual,
  isSizeEqual
} from '@whiteboard/core/geometry'
import type { Node, NodeId, Point, Rect, Size } from '@whiteboard/core/types'

export type ResizeUpdate = {
  position: Point
  size: {
    width: number
    height: number
  }
}

export type ResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: ResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: {
    width: number
    height: number
  }
  startAspect: number
  lastUpdate?: ResizeUpdate
}

export type RotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  currentRotation?: number
  center: Point
}

export type TransformDragState = ResizeDragState | RotateDragState

export type ResizePreviewResult = {
  update: ResizeUpdate
  guides: readonly Guide[]
}

const RESIZE_MIN_SIZE = {
  width: 20,
  height: 20
}

const ZOOM_EPSILON = 0.0001

const readGroupPadding = (
  group: Pick<Node, 'data'>
) => {
  const value = group.data?.padding
  return typeof value === 'number' ? value : undefined
}

const getDirectChildBounds = (
  nodes: readonly Node[],
  groupId: NodeId,
  nodeSize: Size
): Rect | undefined => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    if (node.parentId !== groupId) return
    const rect = getNodeAABB(node, nodeSize)
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  })

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

export const resolveResizeDrag = (options: {
  pointerId: number
  handle: ResizeDirection
  rect: Rect
  rotation: number
  startScreen: Point
}): ResizeDragState => {
  const {
    pointerId,
    handle,
    rect,
    rotation,
    startScreen
  } = options

  return {
    mode: 'resize',
    pointerId,
    handle,
    startScreen,
    startCenter: getRectCenter(rect),
    startRotation: rotation,
    startSize: {
      width: rect.width,
      height: rect.height
    },
    startAspect: rect.width / Math.max(rect.height, ZOOM_EPSILON)
  }
}

export const resolveResizeCommitPatch = (
  node: {
    position: Point
    size?: {
      width: number
      height: number
    }
  },
  update: ResizeUpdate
) => {
  const patch: {
    position?: Point
    size?: {
      width: number
      height: number
    }
  } = {}

  if (!isPointEqual(update.position, node.position)) {
    patch.position = update.position
  }
  if (!isSizeEqual(update.size, node.size)) {
    patch.size = update.size
  }
  if (!patch.position && !patch.size) return
  return patch
}

export const resolveGroupResizePadding = (options: {
  group: Node
  update: ResizeUpdate
  nodes: readonly Node[]
  nodeSize: Size
}) => {
  const { group, update, nodes, nodeSize } = options
  if (group.type !== 'group') return

  const contentRect = getDirectChildBounds(nodes, group.id, nodeSize)
  if (!contentRect) return

  const left = contentRect.x - update.position.x
  const top = contentRect.y - update.position.y
  const right =
    update.position.x + update.size.width - (contentRect.x + contentRect.width)
  const bottom =
    update.position.y + update.size.height - (contentRect.y + contentRect.height)
  const padding = Math.max(0, Math.min(left, top, right, bottom))
  const currentPadding = readGroupPadding(group)

  if (
    currentPadding !== undefined
    && Math.abs(currentPadding - padding) < 0.5
  ) {
    return
  }

  return padding
}

export const resolveResizePreview = (options: {
  snapEnabled: boolean
  drag: ResizeDragState
  currentScreen: Point
  zoom: number
  altKey: boolean
  shiftKey: boolean
  nodeId: NodeId
  config: Pick<BoardConfig, 'node'>
  readSnapCandidatesInRect: (rect: Rect) => readonly SnapCandidate[]
}): ResizePreviewResult => {
  const {
    snapEnabled,
    drag,
    currentScreen,
    zoom,
    altKey,
    shiftKey,
    nodeId,
    config,
    readSnapCandidatesInRect
  } = options

  const safeZoom = resolveInteractionZoom(zoom)
  const resized = computeResizeRect({
    handle: drag.handle,
    startScreen: drag.startScreen,
    currentScreen,
    startCenter: drag.startCenter,
    startRotation: drag.startRotation,
    startSize: drag.startSize,
    startAspect: drag.startAspect,
    minSize: RESIZE_MIN_SIZE,
    zoom: safeZoom,
    altKey,
    shiftKey
  })

  let nextRect = resized.rect
  let nextSize = {
    width: resized.width,
    height: resized.height
  }
  let guides: readonly Guide[] = []

  if (snapEnabled && !altKey && drag.startRotation === 0) {
    const thresholdWorld = resolveSnapThresholdWorld(
      config.node,
      safeZoom
    )
    const movingRect = {
      x: nextRect.x,
      y: nextRect.y,
      width: nextSize.width,
      height: nextSize.height
    }
    const { sourceX, sourceY } = getResizeSourceEdges(drag.handle)
    const snapped = computeResizeSnap({
      movingRect,
      candidates: [
        ...readSnapCandidatesInRect(
          expandRectByThreshold(movingRect, thresholdWorld)
        )
      ],
      threshold: thresholdWorld,
      minSize: RESIZE_MIN_SIZE,
      excludeId: nodeId,
      sourceEdges: {
        sourceX,
        sourceY
      }
    })
    nextRect = snapped.rect
    nextSize = {
      width: snapped.width,
      height: snapped.height
    }
    guides = snapped.guides
  }

  return {
    update: {
      position: {
        x: nextRect.x,
        y: nextRect.y
      },
      size: nextSize
    },
    guides
  }
}

export const resolveRotatePreview = (options: {
  drag: RotateDragState
  currentPoint: Point
  shiftKey: boolean
}) => computeNextRotation({
  center: options.drag.center,
  currentPoint: options.currentPoint,
  startAngle: options.drag.startAngle,
  startRotation: options.drag.startRotation,
  shiftKey: options.shiftKey
})
