import {
  getRectCenter,
  rectContains,
  rectIntersects,
  rotatePoint,
  distancePointToSegment,
  getAABBFromPoints
} from '@whiteboard/core/geometry'
import type { Node, Point, Rect, Size } from '@whiteboard/core/types'

export type ResolvedDrawStroke = Readonly<{
  position: Point
  size: Size
  points: Point[]
}>

export const DRAW_MIN_LENGTH_SCREEN = 4
export const DRAW_SIMPLIFY_DISTANCE_SCREEN = 1.5
const DRAW_PATH_SAMPLE_STEPS = 8

const isFinitePoint = (
  value: unknown
): value is Point => (
  typeof value === 'object'
  && value !== null
  && Number.isFinite((value as Point).x)
  && Number.isFinite((value as Point).y)
)

const midpoint = (
  left: Point,
  right: Point
): Point => ({
  x: (left.x + right.x) / 2,
  y: (left.y + right.y) / 2
})

const distanceSquared = (
  left: Point,
  right: Point
) => {
  const dx = right.x - left.x
  const dy = right.y - left.y
  return (dx * dx) + (dy * dy)
}

const expandRect = (
  rect: Rect,
  padding: number
): Rect => ({
  x: rect.x - padding,
  y: rect.y - padding,
  width: rect.width + padding * 2,
  height: rect.height + padding * 2
})

const isPointInRect = (
  point: Point,
  rect: Rect
) => (
  point.x >= rect.x
  && point.x <= rect.x + rect.width
  && point.y >= rect.y
  && point.y <= rect.y + rect.height
)

const cross = (
  left: Point,
  right: Point,
  target: Point
) => (
  (right.x - left.x) * (target.y - left.y)
  - (right.y - left.y) * (target.x - left.x)
)

const isPointOnSegment = (
  point: Point,
  left: Point,
  right: Point
) => (
  Math.abs(cross(left, right, point)) <= 1e-6
  && point.x >= Math.min(left.x, right.x) - 1e-6
  && point.x <= Math.max(left.x, right.x) + 1e-6
  && point.y >= Math.min(left.y, right.y) - 1e-6
  && point.y <= Math.max(left.y, right.y) + 1e-6
)

const segmentsIntersect = (
  leftStart: Point,
  leftEnd: Point,
  rightStart: Point,
  rightEnd: Point
) => {
  const left1 = cross(leftStart, leftEnd, rightStart)
  const left2 = cross(leftStart, leftEnd, rightEnd)
  const right1 = cross(rightStart, rightEnd, leftStart)
  const right2 = cross(rightStart, rightEnd, leftEnd)

  if (
    ((left1 > 0 && left2 < 0) || (left1 < 0 && left2 > 0))
    && ((right1 > 0 && right2 < 0) || (right1 < 0 && right2 > 0))
  ) {
    return true
  }

  return (
    isPointOnSegment(rightStart, leftStart, leftEnd)
    || isPointOnSegment(rightEnd, leftStart, leftEnd)
    || isPointOnSegment(leftStart, rightStart, rightEnd)
    || isPointOnSegment(leftEnd, rightStart, rightEnd)
  )
}

const segmentIntersectsRect = (
  left: Point,
  right: Point,
  rect: Rect
) => {
  if (isPointInRect(left, rect) || isPointInRect(right, rect)) {
    return true
  }

  const topLeft = { x: rect.x, y: rect.y }
  const topRight = { x: rect.x + rect.width, y: rect.y }
  const bottomRight = { x: rect.x + rect.width, y: rect.y + rect.height }
  const bottomLeft = { x: rect.x, y: rect.y + rect.height }

  return (
    segmentsIntersect(left, right, topLeft, topRight)
    || segmentsIntersect(left, right, topRight, bottomRight)
    || segmentsIntersect(left, right, bottomRight, bottomLeft)
    || segmentsIntersect(left, right, bottomLeft, topLeft)
  )
}

const quadraticPoint = (
  from: Point,
  control: Point,
  to: Point,
  t: number
): Point => {
  const inverse = 1 - t
  return {
    x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
    y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y
  }
}

export const readDrawPoints = (
  node: Pick<Node, 'data'>
): Point[] => {
  const raw = node.data?.points
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter(isFinitePoint)
}

const createDrawWorldProjector = (
  node: Pick<Node, 'data' | 'style' | 'rotation' | 'size'>,
  rect: Rect
) => {
  const baseSize = readDrawBaseSize(node)
  const safeBaseWidth = Math.max(1, baseSize.width)
  const safeBaseHeight = Math.max(1, baseSize.height)
  const scaleX = rect.width / safeBaseWidth
  const scaleY = rect.height / safeBaseHeight
  const center = getRectCenter(rect)
  const rotation = node.rotation ?? 0

  const project = (point: Point): Point => {
    const world = {
      x: rect.x + point.x * scaleX,
      y: rect.y + point.y * scaleY
    }
    return rotation
      ? rotatePoint(world, center, rotation)
      : world
  }

  return {
    project,
    strokeRadius: Math.max(
      1,
      (Math.max(1, (typeof node.style?.strokeWidth === 'number' ? node.style.strokeWidth : 2)) * Math.max(scaleX, scaleY)) / 2
    )
  }
}

const sampleDrawPathPoints = (
  points: readonly Point[]
) => {
  if (points.length <= 2) {
    return [...points]
  }

  const sampled: Point[] = [points[0]]
  let start = points[0]

  for (let index = 1; index < points.length - 1; index += 1) {
    const control = points[index]
    const end = midpoint(control, points[index + 1])
    for (let step = 1; step <= DRAW_PATH_SAMPLE_STEPS; step += 1) {
      sampled.push(quadraticPoint(start, control, end, step / DRAW_PATH_SAMPLE_STEPS))
    }
    start = end
  }

  const last = points[points.length - 1]
  const previous = sampled[sampled.length - 1]
  if (!previous || previous.x !== last.x || previous.y !== last.y) {
    sampled.push(last)
  }

  return sampled
}

const resolveDrawPaintedRect = (
  node: Pick<Node, 'data' | 'style' | 'rotation' | 'size'>,
  rect: Rect
) => {
  const points = readDrawPoints(node)
  if (!points.length) {
    return undefined
  }

  const { project, strokeRadius } = createDrawWorldProjector(node, rect)
  const worldPoints = points.map(project)
  return expandRect(getAABBFromPoints(worldPoints), strokeRadius)
}

export const matchDrawRect = ({
  node,
  rect,
  queryRect,
  mode
}: {
  node: Pick<Node, 'data' | 'style' | 'rotation' | 'size'>
  rect: Rect
  queryRect: Rect
  mode: 'touch' | 'contain'
}) => {
  const paintedRect = resolveDrawPaintedRect(node, rect)
  if (!paintedRect) {
    return false
  }

  if (mode === 'contain') {
    return rectContains(queryRect, paintedRect)
  }

  if (!rectIntersects(queryRect, paintedRect)) {
    return false
  }

  const localPoints = readDrawPoints(node)
  const { project, strokeRadius } = createDrawWorldProjector(node, rect)
  const expandedQueryRect = expandRect(queryRect, strokeRadius)
  const worldPoints = sampleDrawPathPoints(localPoints).map(project)

  if (worldPoints.length === 1) {
    return isPointInRect(worldPoints[0], expandedQueryRect)
  }

  for (let index = 0; index < worldPoints.length; index += 1) {
    if (isPointInRect(worldPoints[index], expandedQueryRect)) {
      return true
    }
    if (index === 0) {
      continue
    }
    if (segmentIntersectsRect(worldPoints[index - 1], worldPoints[index], expandedQueryRect)) {
      return true
    }
  }

  return false
}

const simplifyDrawPointsRadial = (
  points: readonly Point[],
  tolerance: number
) => {
  if (points.length <= 2) {
    return [...points]
  }

  const toleranceSquared = tolerance * tolerance
  const next: Point[] = [points[0]]

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const previous = next[next.length - 1]
    if (distanceSquared(previous, point) >= toleranceSquared) {
      next.push(point)
    }
  }

  const last = points[points.length - 1]
  const previous = next[next.length - 1]
  if (!previous || previous.x !== last.x || previous.y !== last.y) {
    next.push(last)
  }

  return next
}

const simplifyDrawPointsBySegment = (
  points: readonly Point[],
  tolerance: number
) => {
  if (points.length <= 2) {
    return [...points]
  }

  const next: Point[] = [points[0]]

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const previous = next[next.length - 1]
    const after = points[index + 1]
    const distance = distancePointToSegment(point, previous, after)

    if (distance > tolerance) {
      next.push(point)
    }
  }

  const last = points[points.length - 1]
  const previous = next[next.length - 1]
  if (!previous || previous.x !== last.x || previous.y !== last.y) {
    next.push(last)
  }

  return next
}

export const simplifyDrawPoints = ({
  points,
  tolerance
}: {
  points: readonly Point[]
  tolerance: number
}) => {
  const normalized = points.filter(isFinitePoint)
  if (normalized.length <= 2 || tolerance <= 0) {
    return normalized
  }

  return simplifyDrawPointsBySegment(
    simplifyDrawPointsRadial(normalized, tolerance),
    tolerance
  )
}

export const readDrawBaseSize = (
  node: Pick<Node, 'data' | 'size'>
): Size => {
  const raw = node.data?.baseSize
  if (
    raw
    && typeof raw === 'object'
    && Number.isFinite((raw as Size).width)
    && Number.isFinite((raw as Size).height)
  ) {
    return {
      width: Math.max(1, (raw as Size).width),
      height: Math.max(1, (raw as Size).height)
    }
  }

  return {
    width: Math.max(1, node.size?.width ?? 1),
    height: Math.max(1, node.size?.height ?? 1)
  }
}

export const buildDrawPath = (
  points: readonly Point[]
) => {
  if (points.length === 0) {
    return ''
  }

  if (points.length === 1) {
    const point = points[0]
    return `M ${point.x} ${point.y}`
  }

  if (points.length === 2) {
    const [from, to] = points
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index]
    const next = points[index + 1]
    const control = midpoint(point, next)
    path += ` Q ${point.x} ${point.y} ${control.x} ${control.y}`
  }

  const last = points[points.length - 1]
  path += ` L ${last.x} ${last.y}`
  return path
}

export const resolveDrawStroke = ({
  points,
  width
}: {
  points: readonly Point[]
  width: number
}): ResolvedDrawStroke | undefined => {
  const normalized = points.filter(isFinitePoint)
  if (!normalized.length) {
    return undefined
  }

  const bounds = getAABBFromPoints([...normalized])
  const padding = Math.max(4, width)
  const position = {
    x: bounds.x - padding,
    y: bounds.y - padding
  }
  const size = {
    width: Math.max(1, bounds.width) + padding * 2,
    height: Math.max(1, bounds.height) + padding * 2
  }

  return {
    position,
    size,
    points: normalized.map((point) => ({
      x: point.x - position.x,
      y: point.y - position.y
    }))
  }
}

export const DrawStrokeShape = ({
  points,
  color,
  width,
  opacity = 1
}: {
  points: readonly Point[]
  color: string
  width: number
  opacity?: number
}) => {
  if (!points.length) {
    return null
  }

  if (points.length === 1) {
    const point = points[0]
    return (
      <circle
        cx={point.x}
        cy={point.y}
        r={Math.max(1, width / 2)}
        fill={color}
        fillOpacity={opacity}
        pointerEvents="none"
      />
    )
  }

  return (
    <path
      d={buildDrawPath(points)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeOpacity={opacity}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="none"
    />
  )
}

export const DrawStrokeSelectionShape = ({
  points,
  width
}: {
  points: readonly Point[]
  width: number
}) => {
  const haloWidth = Math.max(8, width + 6)

  if (!points.length) {
    return null
  }

  if (points.length === 1) {
    const point = points[0]
    return (
      <circle
        cx={point.x}
        cy={point.y}
        r={Math.max(6, width / 2 + 4)}
        fill="none"
        stroke="hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.3)"
        strokeWidth={haloWidth}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
    )
  }

  return (
    <path
      d={buildDrawPath(points)}
      fill="none"
      stroke="hsl(var(--ui-accent, 209.8 76.7% 51.2%) / 0.3)"
      strokeWidth={haloWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
      pointerEvents="none"
    />
  )
}

export const DrawStrokeHitShape = ({
  points,
  width
}: {
  points: readonly Point[]
  width: number
}) => {
  if (!points.length) {
    return null
  }

  if (points.length === 1) {
    const point = points[0]
    return (
      <circle
        cx={point.x}
        cy={point.y}
        r={Math.max(6, width / 2)}
        fill="rgba(0, 0, 0, 0.001)"
        pointerEvents="all"
      />
    )
  }

  return (
    <path
      d={buildDrawPath(points)}
      fill="none"
      stroke="rgba(0, 0, 0, 0.001)"
      strokeWidth={Math.max(12, width + 10)}
      strokeLinecap="round"
      strokeLinejoin="round"
      pointerEvents="stroke"
      vectorEffect="non-scaling-stroke"
    />
  )
}
