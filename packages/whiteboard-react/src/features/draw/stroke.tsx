import {
  distancePointToSegment,
  getAABBFromPoints
} from '@whiteboard/core/geometry'
import type { Node, Point, Size } from '@whiteboard/core/types'

export type ResolvedDrawStroke = Readonly<{
  position: Point
  size: Size
  points: Point[]
}>

export const DRAW_MIN_LENGTH_SCREEN = 4
export const DRAW_SIMPLIFY_DISTANCE_SCREEN = 1.5

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

export const readDrawPoints = (
  node: Pick<Node, 'data'>
): Point[] => {
  const raw = node.data?.points
  if (!Array.isArray(raw)) {
    return []
  }

  return raw.filter(isFinitePoint)
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
