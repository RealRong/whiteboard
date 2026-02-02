import type { EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import type { Size } from '../types'

export const DEFAULT_NODE_SIZE: Size = { width: 120, height: 72 }
export const DEFAULT_MINDMAP_NODE_SIZE: Size = { width: 140, height: 36 }

export const getNodeRect = (node: Node, fallback: Size): Rect => {
  const width = node.size?.width ?? fallback.width
  const height = node.size?.height ?? fallback.height
  return {
    x: node.position.x,
    y: node.position.y,
    width,
    height
  }
}

export const getRectCenter = (rect: Rect): Point => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2
})

export const rectFromPoints = (a: Point, b: Point): Rect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  const width = Math.abs(a.x - b.x)
  const height = Math.abs(a.y - b.y)
  return { x, y, width, height }
}

export const rectContains = (outer: Rect, inner: Rect) => {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}

export const rectIntersects = (a: Rect, b: Rect) => {
  return (
    a.x <= b.x + b.width &&
    a.x + a.width >= b.x &&
    a.y <= b.y + b.height &&
    a.y + a.height >= b.y
  )
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const getRectCorners = (rect: Rect): Point[] => [
  { x: rect.x, y: rect.y },
  { x: rect.x + rect.width, y: rect.y },
  { x: rect.x + rect.width, y: rect.y + rect.height },
  { x: rect.x, y: rect.y + rect.height }
]

export const degToRad = (deg: number) => (deg * Math.PI) / 180

export const getRotatedCorners = (rect: Rect, rotation = 0): Point[] => {
  if (!rotation) {
    return [
      { x: rect.x, y: rect.y },
      { x: rect.x + rect.width, y: rect.y },
      { x: rect.x + rect.width, y: rect.y + rect.height },
      { x: rect.x, y: rect.y + rect.height }
    ]
  }
  const center = getRectCenter(rect)
  const angle = degToRad(rotation)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height }
  ]
  return corners.map((corner) => {
    const dx = corner.x - center.x
    const dy = corner.y - center.y
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos
    }
  })
}

export const getAABBFromPoints = (points: Point[]): Rect => {
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  })
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

export const getNodeAABB = (node: Node, fallback: Size): Rect => {
  const rect = getNodeRect(node, fallback)
  const rotation = typeof node.rotation === 'number' ? node.rotation : 0
  if (!rotation) return rect
  const corners = getRotatedCorners(rect, rotation)
  return getAABBFromPoints(corners)
}

export const rotatePoint = (point: Point, center: Point, rotation = 0): Point => {
  if (!rotation) return { x: point.x, y: point.y }
  const angle = degToRad(rotation)
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const dx = point.x - center.x
  const dy = point.y - center.y
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  }
}

export const isPointInRotatedRect = (point: Point, rect: Rect, rotation = 0): boolean => {
  if (!rotation) {
    return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height
  }
  const center = getRectCenter(rect)
  const local = rotatePoint(point, center, -rotation)
  return local.x >= rect.x && local.x <= rect.x + rect.width && local.y >= rect.y && local.y <= rect.y + rect.height
}

const projectPoints = (points: Point[], axis: Point) => {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  points.forEach((point) => {
    const value = point.x * axis.x + point.y * axis.y
    min = Math.min(min, value)
    max = Math.max(max, value)
  })
  return { min, max }
}

const getAxes = (points: Point[]) => {
  const axes: Point[] = []
  for (let i = 0; i < points.length; i += 1) {
    const p1 = points[i]
    const p2 = points[(i + 1) % points.length]
    const edge = { x: p2.x - p1.x, y: p2.y - p1.y }
    axes.push({ x: -edge.y, y: edge.x })
  }
  return axes
}

export const rectIntersectsRotatedRect = (outer: Rect, rect: Rect, rotation = 0): boolean => {
  if (!rotation) return rectIntersects(outer, rect)
  const a = getRectCorners(outer)
  const b = getRotatedCorners(rect, rotation)
  const axes = [...getAxes(a), ...getAxes(b)]
  for (const axis of axes) {
    const projA = projectPoints(a, axis)
    const projB = projectPoints(b, axis)
    if (projA.max < projB.min || projB.max < projA.min) {
      return false
    }
  }
  return true
}

export const rectContainsRotatedRect = (outer: Rect, rect: Rect, rotation = 0): boolean => {
  const corners = rotation ? getRotatedCorners(rect, rotation) : getRectCorners(rect)
  return corners.every(
    (point) =>
      point.x >= outer.x &&
      point.x <= outer.x + outer.width &&
      point.y >= outer.y &&
      point.y <= outer.y + outer.height
  )
}

export const distancePointToSegment = (point: Point, a: Point, b: Point) => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const apx = point.x - a.x
  const apy = point.y - a.y
  const abLenSq = abx * abx + aby * aby
  if (abLenSq === 0) return Math.hypot(apx, apy)
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq))
  const closest = { x: a.x + abx * t, y: a.y + aby * t }
  return Math.hypot(point.x - closest.x, point.y - closest.y)
}

export const getAnchorPoint = (rect: Rect, anchor?: EdgeAnchor, rotation = 0): Point => {
  if (!anchor) {
    return getRectCenter(rect)
  }
  const offset = Number.isFinite(anchor.offset) ? anchor.offset : 0.5
  let point: Point
  switch (anchor.side) {
    case 'top':
      point = { x: rect.x + rect.width * offset, y: rect.y }
      break
    case 'right':
      point = { x: rect.x + rect.width, y: rect.y + rect.height * offset }
      break
    case 'bottom':
      point = { x: rect.x + rect.width * offset, y: rect.y + rect.height }
      break
    case 'left':
      point = { x: rect.x, y: rect.y + rect.height * offset }
      break
    default:
      point = getRectCenter(rect)
      break
  }
  if (!rotation) return point
  return rotatePoint(point, getRectCenter(rect), rotation)
}
