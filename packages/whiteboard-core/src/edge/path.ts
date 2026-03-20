import type { EdgeAnchor, Point } from '../types/core'
import { getBezierPath, getSmoothPolyPath } from '../utils/path'
import type {
  EdgePathInput,
  EdgePathResult,
  EdgePathSegment,
  EdgeRouter
} from './types'

const DEFAULT_ORTHO_OFFSET = 50
const DEFAULT_CURVE_CURVATURE = 0.35
const DEFAULT_STEP_ENDPOINT_OFFSET = 24

const EDGE_SIDE_VECTOR: Record<EdgeAnchor['side'], Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 }
}

const getAutoSide = (from: Point, to: Point): EdgeAnchor['side'] => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'bottom' : 'top'
}

const resolveSide = (
  side: EdgeAnchor['side'] | undefined,
  from: Point,
  to: Point
) => side ?? getAutoSide(from, to)

const getPathPoints = (
  input: EdgePathInput
) => [
  input.source.point,
  ...(input.edge.path?.points ?? []),
  input.target.point
]

const buildPolylinePath = (points: Point[]) => {
  if (points.length === 0) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
}

const getMidPoint = (
  from: Point,
  to: Point
): Point => ({
  x: (from.x + to.x) / 2,
  y: (from.y + to.y) / 2
})

const isSamePoint = (left: Point, right: Point) => (
  left.x === right.x && left.y === right.y
)

const pushPoint = (
  points: Point[],
  point: Point
) => {
  const last = points[points.length - 1]
  if (!last || !isSamePoint(last, point)) {
    points.push(point)
  }
}

const createSegments = (
  points: readonly Point[],
  insertIndex: number | ((segmentIndex: number) => number)
): EdgePathSegment[] => {
  const segments: EdgePathSegment[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (isSamePoint(from, to)) {
      continue
    }

    segments.push({
      from,
      to,
      insertPoint: getMidPoint(from, to),
      insertIndex: typeof insertIndex === 'function'
        ? insertIndex(index)
        : insertIndex
    })
  }

  return segments
}

const chooseStepCorner = (
  from: Point,
  to: Point
): Point => {
  const dx = Math.abs(to.x - from.x)
  const dy = Math.abs(to.y - from.y)

  if (dx >= dy) {
    return {
      x: to.x,
      y: from.y
    }
  }

  return {
    x: from.x,
    y: to.y
  }
}

const getStepGapPoint = (
  point: Point,
  side: EdgeAnchor['side'],
  reference: Point
): Point => {
  const vector = EDGE_SIDE_VECTOR[side]
  const projectedDistance =
    vector.x !== 0
      ? (reference.x - point.x) * vector.x
      : (reference.y - point.y) * vector.y
  const offset =
    projectedDistance > 0
      ? Math.min(DEFAULT_STEP_ENDPOINT_OFFSET, projectedDistance / 2)
      : DEFAULT_STEP_ENDPOINT_OFFSET

  if (offset <= 0) {
    return point
  }

  return {
    x: point.x + vector.x * offset,
    y: point.y + vector.y * offset
  }
}

const buildStepPathThroughPoints = (
  input: EdgePathInput
): Pick<EdgePathResult, 'points' | 'segments' | 'svgPath' | 'label'> => {
  const anchors = getPathPoints(input)
  const points: Point[] = []
  const segments: EdgePathSegment[] = []

  for (let index = 0; index < anchors.length - 1; index += 1) {
    const anchorFrom = anchors[index]
    const anchorTo = anchors[index + 1]
    const start =
      index === 0 && input.source.side
        ? getStepGapPoint(anchorFrom, input.source.side, anchorTo)
        : anchorFrom
    const end =
      index === anchors.length - 2 && input.target.side
        ? getStepGapPoint(anchorTo, input.target.side, anchorFrom)
        : anchorTo
    const segmentPoints: Point[] = [anchorFrom]

    if (!isSamePoint(anchorFrom, start)) {
      segmentPoints.push(start)
    }

    if (!isSamePoint(start, end) && start.x !== end.x && start.y !== end.y) {
      segmentPoints.push(chooseStepCorner(start, end))
    }

    if (!isSamePoint(start, end)) {
      segmentPoints.push(end)
    }
    if (!isSamePoint(end, anchorTo)) {
      segmentPoints.push(anchorTo)
    }

    createSegments(segmentPoints, index).forEach((segment) => {
      segments.push(segment)
    })
    segmentPoints.forEach((point) => {
      pushPoint(points, point)
    })
  }

  return {
    points,
    segments,
    svgPath: buildPolylinePath(points),
    label: getPolylineLabel(points)
  }
}

const getPolylineLabel = (points: Point[]): Point | undefined => {
  if (points.length === 0) return undefined
  if (points.length === 1) return points[0]
  const mid = Math.floor(points.length / 2)
  if (points.length % 2 === 1) return points[mid]
  const a = points[mid - 1]
  const b = points[mid]
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

const pointOnCubicBezier = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number
): Point => {
  const mt = 1 - t
  const mt2 = mt * mt
  const mt3 = mt2 * mt
  const t2 = t * t
  const t3 = t2 * t

  return {
    x: mt3 * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t3 * p3.x,
    y: mt3 * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t3 * p3.y
  }
}

const sampleCubicBezier = (
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  steps = 16
) => {
  const points: Point[] = []

  for (let index = 0; index <= steps; index += 1) {
    points.push(pointOnCubicBezier(p0, p1, p2, p3, index / steps))
  }

  return points
}

const getCurveControls = (
  points: readonly Point[],
  index: number
) => {
  const previous = points[index - 1] ?? points[index]
  const current = points[index]
  const next = points[index + 1]
  const afterNext = points[index + 2] ?? next

  return {
    control1: {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6
    },
    control2: {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6
    }
  }
}

const createCurveSegments = (
  points: readonly Point[]
): EdgePathSegment[] => {
  const segments: EdgePathSegment[] = []

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index]
    const to = points[index + 1]
    if (isSamePoint(from, to)) {
      continue
    }

    const {
      control1,
      control2
    } = getCurveControls(points, index)
    const hitPoints = sampleCubicBezier(from, control1, control2, to)

    segments.push({
      from,
      to,
      insertIndex: index,
      insertPoint: pointOnCubicBezier(from, control1, control2, to, 0.5),
      hitPoints
    })
  }

  return segments
}

const getBezierControlOffset = (
  distanceValue: number,
  curvature: number
): number => {
  if (distanceValue >= 0) {
    return 0.5 * distanceValue
  }

  return curvature * 25 * Math.sqrt(-distanceValue)
}

const getBezierControlPoint = ({
  side,
  from,
  to,
  curvature
}: {
  side: EdgeAnchor['side']
  from: Point
  to: Point
  curvature: number
}): Point => {
  switch (side) {
    case 'left':
      return {
        x: from.x - getBezierControlOffset(from.x - to.x, curvature),
        y: from.y
      }
    case 'right':
      return {
        x: from.x + getBezierControlOffset(to.x - from.x, curvature),
        y: from.y
      }
    case 'top':
      return {
        x: from.x,
        y: from.y - getBezierControlOffset(from.y - to.y, curvature)
      }
    case 'bottom':
    default:
      return {
        x: from.x,
        y: from.y + getBezierControlOffset(to.y - from.y, curvature)
      }
  }
}

const buildSmoothCurvePath = (points: Point[]) => {
  if (points.length === 0) return ''
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`
  }

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const { control1, control2 } = getCurveControls(points, index)

    path += ` C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${next.x} ${next.y}`
  }

  return path
}

const linearRouter: EdgeRouter = (input) => {
  const points = getPathPoints(input)
  return {
    points,
    segments: createSegments(points, (index) => index),
    svgPath: buildPolylinePath(points),
    label: getPolylineLabel(points)
  }
}

const stepRouter: EdgeRouter = ({ edge, source, target }) => {
  if (edge.path?.points?.length) {
    return buildStepPathThroughPoints({
      edge,
      source,
      target
    })
  }

  const sourceSide = resolveSide(source.side, source.point, target.point)
  const targetSide = resolveSide(target.side, target.point, source.point)
  const [path, labelX, labelY, , , points] = getSmoothPolyPath({
    sourceX: source.point.x,
    sourceY: source.point.y,
    sourcePosition: sourceSide,
    targetX: target.point.x,
    targetY: target.point.y,
    targetPosition: targetSide,
    borderRadius: 0,
    offset: DEFAULT_ORTHO_OFFSET
  })

  return {
    points,
    segments: createSegments(points, 0),
    svgPath: path,
    label: { x: labelX, y: labelY }
  }
}

const curveRouter: EdgeRouter = ({ edge, source, target }) => {
  const points = getPathPoints({
    edge,
    source,
    target
  })
  if (points.length <= 2) {
    const sourceSide = resolveSide(source.side, source.point, target.point)
    const targetSide = resolveSide(target.side, target.point, source.point)
    const sourceControl = getBezierControlPoint({
      side: sourceSide,
      from: source.point,
      to: target.point,
      curvature: DEFAULT_CURVE_CURVATURE
    })
    const targetControl = getBezierControlPoint({
      side: targetSide,
      from: target.point,
      to: source.point,
      curvature: DEFAULT_CURVE_CURVATURE
    })
    const [path, labelX, labelY] = getBezierPath({
      sourceX: source.point.x,
      sourceY: source.point.y,
      targetX: target.point.x,
      targetY: target.point.y,
      sourcePosition: sourceSide,
      targetPosition: targetSide,
      curvature: DEFAULT_CURVE_CURVATURE
    })
    return {
      points,
      segments: [{
        from: source.point,
        to: target.point,
        insertIndex: 0,
        insertPoint: pointOnCubicBezier(source.point, sourceControl, targetControl, target.point, 0.5),
        hitPoints: sampleCubicBezier(source.point, sourceControl, targetControl, target.point)
      }],
      svgPath: path,
      label: { x: labelX, y: labelY }
    }
  }

  return {
    points,
    segments: createCurveSegments(points),
    svgPath: buildSmoothCurvePath(points),
    label: getPolylineLabel(points)
  }
}

const customRouter: EdgeRouter = (input) => linearRouter(input)

const EDGE_ROUTERS: Record<string, EdgeRouter> = {
  linear: linearRouter,
  step: stepRouter,
  curve: curveRouter,
  custom: customRouter
}

export const getEdgePath = (input: EdgePathInput): EdgePathResult => {
  const router = EDGE_ROUTERS[input.edge.type] ?? linearRouter
  return router(input)
}
