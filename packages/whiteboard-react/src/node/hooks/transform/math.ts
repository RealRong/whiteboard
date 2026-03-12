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
import { getRectCenter, isPointEqual, isSizeEqual } from '@whiteboard/core/geometry'
import type { InstanceConfig } from '@whiteboard/engine'
import type { NodeId, Point, Rect } from '@whiteboard/core/types'

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

export const resolveResizePreview = (options: {
  activeTool: string
  drag: ResizeDragState
  currentScreen: Point
  zoom: number
  altKey: boolean
  shiftKey: boolean
  nodeId: NodeId
  config: Pick<InstanceConfig, 'node'>
  readSnapCandidatesInRect: (rect: Rect) => readonly SnapCandidate[]
}): ResizePreviewResult => {
  const {
    activeTool,
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

  if (activeTool === 'select' && !altKey && drag.startRotation === 0) {
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
