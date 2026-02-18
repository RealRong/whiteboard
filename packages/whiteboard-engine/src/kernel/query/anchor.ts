import type { EdgeAnchor, Point, Rect } from '@whiteboard/core'
import type { EdgeConnectState } from '@engine-types/state'
import { DEFAULT_TUNING } from '../../config'
import { clamp, getAnchorPoint, getRectCenter, rotatePoint } from '../geometry'

const getSideCenters = (rect: Rect) => ({
  top: { x: rect.x + rect.width / 2, y: rect.y },
  right: { x: rect.x + rect.width, y: rect.y + rect.height / 2 },
  bottom: { x: rect.x + rect.width / 2, y: rect.y + rect.height },
  left: { x: rect.x, y: rect.y + rect.height / 2 }
})

const distance = (left: Point, right: Point) => Math.hypot(left.x - right.x, left.y - right.y)

const getNearestSide = (rect: Rect, point: Point) => {
  const centers = getSideCenters(rect)
  const entries = Object.entries(centers) as Array<[EdgeAnchor['side'], Point]>
  let best = entries[0]
  let bestDistance = distance(point, entries[0][1])
  entries.slice(1).forEach((entry) => {
    const nextDistance = distance(point, entry[1])
    if (nextDistance < bestDistance) {
      best = entry
      bestDistance = nextDistance
    }
  })
  return {
    side: best[0],
    distance: bestDistance
  }
}

export type AnchorSnapOptions = {
  snapMin: number
  snapRatio: number
}

export const getAnchorFromPoint = (rect: Rect, rotation: number, point: Point, options: AnchorSnapOptions) => {
  const center = getRectCenter(rect)
  const localPoint = rotatePoint(point, center, -rotation)
  const nearest = getNearestSide(rect, localPoint)
  const threshold = Math.max(
    options.snapMin,
    Math.min(rect.width, rect.height) * options.snapRatio
  )
  const useCenter = nearest.distance <= threshold
  let offset: number = DEFAULT_TUNING.edge.anchorOffset

  if (!useCenter) {
    if (nearest.side === 'top' || nearest.side === 'bottom') {
      offset =
        rect.width === 0
          ? DEFAULT_TUNING.edge.anchorOffset
          : clamp((localPoint.x - rect.x) / rect.width, 0, 1)
    } else {
      offset =
        rect.height === 0
          ? DEFAULT_TUNING.edge.anchorOffset
          : clamp((localPoint.y - rect.y) / rect.height, 0, 1)
    }
  }

  const anchor: EdgeAnchor = { side: nearest.side, offset }
  return {
    anchor,
    point: getAnchorPoint(rect, anchor, rotation)
  }
}

export const getAutoAnchorFromRect = (rect: Rect, rotation: number, otherCenter: Point) => {
  const center = getRectCenter(rect)
  const dx = otherCenter.x - center.x
  const dy = otherCenter.y - center.y
  const side: EdgeAnchor['side'] =
    Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'bottom' : 'top'
  const anchor: EdgeAnchor = { side, offset: DEFAULT_TUNING.edge.anchorOffset }
  return {
    anchor,
    point: getAnchorPoint(rect, anchor, rotation)
  }
}

export type ConnectTo = NonNullable<EdgeConnectState['to']>

export const isSameConnectTo = (left?: EdgeConnectState['hover'], right?: ConnectTo) => {
  if (!left && !right) return true
  if (!left || !right) return false
  return (
    left.nodeId === right.nodeId &&
    left.anchor?.side === right.anchor?.side &&
    left.anchor?.offset === right.anchor?.offset &&
    left.pointWorld?.x === right.pointWorld?.x &&
    left.pointWorld?.y === right.pointWorld?.y
  )
}
