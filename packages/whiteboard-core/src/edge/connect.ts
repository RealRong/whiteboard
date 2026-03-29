import type {
  Node,
  Point,
  Rect,
  Size
} from '../types'
import {
  pickNearest,
  rectFromPoint,
  resolveScreenDistanceWorld
} from '../snap'
import type {
  EdgeConnectCandidate,
  EdgeConnectConfig,
  EdgeConnectResult
} from '../types/edge'
import { getAnchorFromPoint } from './anchor'

type ScoredConnectTarget = EdgeConnectResult & {
  distance: number
}

export const DEFAULT_EDGE_ANCHOR_OFFSET = 0.5

const distanceToRect = (
  rect: Rect,
  point: Point
) => {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
  return Math.hypot(dx, dy)
}

export const resolveAnchorSnapMinWorld = (
  config: EdgeConnectConfig,
  zoom: number,
  zoomEpsilon = 0.0001
) => resolveScreenDistanceWorld(
  config.anchorSnapMin,
  zoom,
  zoomEpsilon
)

export const resolveEdgeConnectThresholdWorld = (
  config: EdgeConnectConfig,
  zoom: number,
  rect: Pick<Rect, 'width' | 'height'>
) => Math.max(
  resolveAnchorSnapMinWorld(config, zoom),
  Math.min(rect.width, rect.height) * config.anchorSnapRatio
)

export const resolveEdgeConnectQueryRect = (
  pointWorld: Point,
  zoom: number,
  config: EdgeConnectConfig,
  nodeSize: Size
) => rectFromPoint(
  pointWorld,
  resolveEdgeConnectThresholdWorld(config, zoom, nodeSize)
)

export const resolveAnchorFromPoint = ({
  node,
  rect,
  rotation,
  pointWorld,
  zoom,
  config,
  anchorOffset = DEFAULT_EDGE_ANCHOR_OFFSET
}: {
  node: Pick<Node, 'type' | 'data'>
  rect: Rect
  rotation: number
  pointWorld: Point
  zoom: number
  config: EdgeConnectConfig
  anchorOffset?: number
}) => getAnchorFromPoint(node, rect, rotation, pointWorld, {
  snapMin: resolveAnchorSnapMinWorld(config, zoom),
  snapRatio: config.anchorSnapRatio,
  anchorOffset
})

export const resolveEdgeConnectTarget = ({
  pointWorld,
  candidates,
  zoom,
  config,
  anchorOffset = DEFAULT_EDGE_ANCHOR_OFFSET
}: {
  pointWorld: Point
  candidates: readonly EdgeConnectCandidate[]
  zoom: number
  config: EdgeConnectConfig
  anchorOffset?: number
}): EdgeConnectResult | undefined => {
  const scored: ScoredConnectTarget[] = []

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index]
    const threshold = resolveEdgeConnectThresholdWorld(
      config,
      zoom,
      candidate.rect
    )

    if (distanceToRect(candidate.aabb, pointWorld) > threshold) {
      continue
    }

    const resolved = resolveAnchorFromPoint({
      node: candidate.node,
      rect: candidate.rect,
      rotation: candidate.rotation,
      pointWorld,
      zoom,
      config,
      anchorOffset
    })
    const distance = Math.hypot(
      resolved.point.x - pointWorld.x,
      resolved.point.y - pointWorld.y
    )
    if (distance > threshold) {
      continue
    }

    scored.push({
      nodeId: candidate.nodeId,
      anchor: resolved.anchor,
      pointWorld: resolved.point,
      distance
    })
  }

  const best = pickNearest(scored, (item) => item.distance)
  if (!best) {
    return undefined
  }

  return {
    nodeId: best.nodeId,
    anchor: best.anchor,
    pointWorld: best.pointWorld
  }
}
