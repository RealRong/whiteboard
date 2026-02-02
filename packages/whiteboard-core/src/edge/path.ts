import type { EdgeAnchor, Point } from '../types/core'
import { getBezierPath, getSmoothPolyPath } from '../utils/path'
import { getEdgeRouter, registerEdgeRouter } from './router'
import type { EdgePathInput, EdgePathResult, EdgeRouter } from './types'

const DEFAULT_ORTHO_OFFSET = 50
const DEFAULT_BEZIER_CURVATURE = 0.25
const DEFAULT_CURVE_CURVATURE = 0.35

const getAutoSide = (from: Point, to: Point): EdgeAnchor['side'] => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? 'right' : 'left'
  }
  return dy >= 0 ? 'bottom' : 'top'
}

const resolveSide = (side: EdgeAnchor['side'] | undefined, from: Point, to: Point) => side ?? getAutoSide(from, to)

const buildPolylinePath = (points: Point[]) => {
  if (points.length === 0) return ''
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
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

const linearRouter: EdgeRouter = ({ source, target }) => {
  const points = [source.point, target.point]
  return {
    points,
    svgPath: buildPolylinePath(points),
    label: getPolylineLabel(points)
  }
}

const polylineRouter: EdgeRouter = ({ edge, source, target }) => {
  const points = [source.point, ...(edge.routing?.points ?? []), target.point]
  return {
    points,
    svgPath: buildPolylinePath(points),
    label: getPolylineLabel(points)
  }
}

const stepRouter: EdgeRouter = ({ edge, source, target }) => {
  if (edge.routing?.mode === 'manual' && edge.routing.points?.length) {
    return polylineRouter({ edge, source, target })
  }
  const sourceSide = resolveSide(source.side, source.point, target.point)
  const targetSide = resolveSide(target.side, target.point, source.point)
  const offset = edge.routing?.ortho?.offset ?? DEFAULT_ORTHO_OFFSET
  const radius = edge.routing?.ortho?.radius ?? 0
  const [path, labelX, labelY, , , points] = getSmoothPolyPath({
    sourceX: source.point.x,
    sourceY: source.point.y,
    sourcePosition: sourceSide,
    targetX: target.point.x,
    targetY: target.point.y,
    targetPosition: targetSide,
    borderRadius: radius,
    offset
  })
  return {
    points,
    svgPath: path,
    label: { x: labelX, y: labelY }
  }
}

const bezierRouter: EdgeRouter = ({ source, target }) => {
  const sourceSide = resolveSide(source.side, source.point, target.point)
  const targetSide = resolveSide(target.side, target.point, source.point)
  const [path, labelX, labelY] = getBezierPath({
    sourceX: source.point.x,
    sourceY: source.point.y,
    targetX: target.point.x,
    targetY: target.point.y,
    sourcePosition: sourceSide,
    targetPosition: targetSide,
    curvature: DEFAULT_BEZIER_CURVATURE
  })
  return {
    points: [source.point, target.point],
    svgPath: path,
    label: { x: labelX, y: labelY }
  }
}

const curveRouter: EdgeRouter = ({ source, target }) => {
  const sourceSide = resolveSide(source.side, source.point, target.point)
  const targetSide = resolveSide(target.side, target.point, source.point)
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
    points: [source.point, target.point],
    svgPath: path,
    label: { x: labelX, y: labelY }
  }
}

const customRouter: EdgeRouter = ({ edge, source, target }) => {
  if (edge.routing?.points?.length) {
    return polylineRouter({ edge, source, target })
  }
  return linearRouter({ edge, source, target })
}

let routersInitialized = false

const ensureRouters = () => {
  if (routersInitialized) return
  registerEdgeRouter('linear', linearRouter)
  registerEdgeRouter('step', stepRouter)
  registerEdgeRouter('polyline', polylineRouter)
  registerEdgeRouter('bezier', bezierRouter)
  registerEdgeRouter('curve', curveRouter)
  registerEdgeRouter('custom', customRouter)
  routersInitialized = true
}

export const getEdgePath = (input: EdgePathInput): EdgePathResult => {
  ensureRouters()
  if (input.edge.routing?.mode === 'manual' && input.edge.routing.points?.length) {
    return polylineRouter(input)
  }
  const router = getEdgeRouter(input.edge.type) ?? linearRouter
  return router(input)
}
