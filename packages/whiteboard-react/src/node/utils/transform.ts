import type { Point, Rect } from '@whiteboard/core'
import type { Size } from 'types/common'
import type { ResizeDirection, TransformHandle } from 'types/node'
import { getRectCenter, rotatePoint } from '../../common/utils/geometry'

const MIN_ZOOM = 0.0001
const ROTATE_SNAP_STEP = 15

type ResizeHandleMeta = {
  sx: -1 | 0 | 1
  sy: -1 | 0 | 1
  cursor: string
}

export type HorizontalResizeEdge = 'left' | 'right'
export type VerticalResizeEdge = 'top' | 'bottom'

export const resizeHandleMap: Record<ResizeDirection, ResizeHandleMeta> = {
  nw: { sx: -1, sy: -1, cursor: 'nwse-resize' },
  n: { sx: 0, sy: -1, cursor: 'ns-resize' },
  ne: { sx: 1, sy: -1, cursor: 'nesw-resize' },
  e: { sx: 1, sy: 0, cursor: 'ew-resize' },
  se: { sx: 1, sy: 1, cursor: 'nwse-resize' },
  s: { sx: 0, sy: 1, cursor: 'ns-resize' },
  sw: { sx: -1, sy: 1, cursor: 'nesw-resize' },
  w: { sx: -1, sy: 0, cursor: 'ew-resize' }
}

export const getResizeSourceEdges = (
  handle: ResizeDirection
): { sourceX?: HorizontalResizeEdge; sourceY?: VerticalResizeEdge } => {
  const sourceX: HorizontalResizeEdge | undefined = handle.includes('w')
    ? 'left'
    : handle.includes('e')
      ? 'right'
      : undefined
  const sourceY: VerticalResizeEdge | undefined = handle.includes('n')
    ? 'top'
    : handle.includes('s')
      ? 'bottom'
      : undefined
  return { sourceX, sourceY }
}

export const rotateVector = (vector: Point, rotation: number) => rotatePoint(vector, { x: 0, y: 0 }, rotation)

export const getWorldPointFromClient = (options: {
  clientX: number
  clientY: number
  container: HTMLElement | null | undefined
  screenToWorld?: (point: Point) => Point
}) => {
  const { clientX, clientY, container, screenToWorld } = options
  if (!container || !screenToWorld) return null
  const rect = container.getBoundingClientRect()
  return screenToWorld({ x: clientX - rect.left, y: clientY - rect.top })
}

export const buildTransformHandles = (options: {
  rect: Rect
  rotation: number
  canRotate: boolean
  rotateHandleOffset: number
  zoom: number
}): TransformHandle[] => {
  const { rect, rotation, canRotate, rotateHandleOffset, zoom } = options
  const center = getRectCenter(rect)
  const cx = rect.x + rect.width / 2
  const cy = rect.y + rect.height / 2
  const localPositions: Record<ResizeDirection, Point> = {
    nw: { x: rect.x, y: rect.y },
    n: { x: cx, y: rect.y },
    ne: { x: rect.x + rect.width, y: rect.y },
    e: { x: rect.x + rect.width, y: cy },
    se: { x: rect.x + rect.width, y: rect.y + rect.height },
    s: { x: cx, y: rect.y + rect.height },
    sw: { x: rect.x, y: rect.y + rect.height },
    w: { x: rect.x, y: cy }
  }
  const positions = Object.fromEntries(
    (Object.keys(localPositions) as ResizeDirection[]).map((direction) => [
      direction,
      rotatePoint(localPositions[direction], center, rotation)
    ])
  ) as Record<ResizeDirection, Point>
  const resizeHandles = (Object.keys(positions) as ResizeDirection[]).map((direction) => ({
    id: `resize-${direction}`,
    kind: 'resize' as const,
    direction,
    position: positions[direction],
    cursor: resizeHandleMap[direction].cursor
  }))
  if (!canRotate) return resizeHandles

  const offsetWorld = rotateHandleOffset / Math.max(zoom, MIN_ZOOM)
  const normal = rotateVector({ x: 0, y: -1 }, rotation)
  const topMid = positions.n
  return [
    ...resizeHandles,
    {
      id: 'rotate',
      kind: 'rotate',
      position: { x: topMid.x + normal.x * offsetWorld, y: topMid.y + normal.y * offsetWorld },
      cursor: 'grab'
    }
  ]
}

export const computeResizeRect = (options: {
  handle: ResizeDirection
  startScreen: Point
  currentScreen: Point
  startCenter: Point
  startRotation: number
  startSize: Size
  startAspect: number
  minSize: Size
  zoom: number
  altKey: boolean
  shiftKey: boolean
}) => {
  const {
    handle,
    startScreen,
    currentScreen,
    startCenter,
    startRotation,
    startSize,
    startAspect,
    minSize,
    zoom,
    altKey,
    shiftKey
  } = options
  const safeZoom = Math.max(zoom, MIN_ZOOM)
  const deltaWorld = {
    x: (currentScreen.x - startScreen.x) / safeZoom,
    y: (currentScreen.y - startScreen.y) / safeZoom
  }
  const localDelta = rotateVector(deltaWorld, -startRotation)
  const { sx, sy } = resizeHandleMap[handle]

  let width = startSize.width
  let height = startSize.height
  if (sx !== 0) {
    width += localDelta.x * sx * (altKey ? 2 : 1)
  }
  if (sy !== 0) {
    height += localDelta.y * sy * (altKey ? 2 : 1)
  }
  if (shiftKey && sx !== 0 && sy !== 0) {
    if (Math.abs(localDelta.x) > Math.abs(localDelta.y)) {
      height = width / startAspect
    } else {
      width = height * startAspect
    }
  }

  width = Math.max(minSize.width, width)
  height = Math.max(minSize.height, height)

  let centerOffset = { x: 0, y: 0 }
  if (!altKey) {
    if (sx !== 0) {
      centerOffset.x = ((width - startSize.width) * sx) / 2
    }
    if (sy !== 0) {
      centerOffset.y = ((height - startSize.height) * sy) / 2
    }
  }
  const worldCenterOffset = rotateVector(centerOffset, startRotation)
  const nextCenter = {
    x: startCenter.x + worldCenterOffset.x,
    y: startCenter.y + worldCenterOffset.y
  }

  return {
    width,
    height,
    rect: {
      x: nextCenter.x - width / 2,
      y: nextCenter.y - height / 2,
      width,
      height
    }
  }
}

export const computeNextRotation = (options: {
  center: Point
  currentPoint: Point
  startAngle: number
  startRotation: number
  shiftKey: boolean
}) => {
  const { center, currentPoint, startAngle, startRotation, shiftKey } = options
  const angle = Math.atan2(currentPoint.y - center.y, currentPoint.x - center.x)
  let nextRotation = startRotation + ((angle - startAngle) * 180) / Math.PI
  if (shiftKey) {
    nextRotation = Math.round(nextRotation / ROTATE_SNAP_STEP) * ROTATE_SNAP_STEP
  }
  return nextRotation
}
