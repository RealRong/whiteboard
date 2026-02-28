import { getAnchorPoint, getRectCenter } from '../geometry'
import type { Edge, EdgeAnchor, NodeId, Point, Rect } from '../types/core'
import { getAutoAnchorFromRect } from './anchor'

export type ResolvedEdgeEndpoint = {
  nodeId: NodeId
  anchor: EdgeAnchor
  point: Point
}

export type ResolvedEdgeEndpoints = {
  source: ResolvedEdgeEndpoint
  target: ResolvedEdgeEndpoint
}

export type ResolveEdgeEndpointsInput = {
  edge: Edge
  source: {
    rect: Rect
    rotation?: number
  }
  target: {
    rect: Rect
    rotation?: number
  }
}

export const resolveEdgeEndpoints = ({
  edge,
  source,
  target
}: ResolveEdgeEndpointsInput): ResolvedEdgeEndpoints => {
  const sourceRotation = source.rotation ?? 0
  const targetRotation = target.rotation ?? 0
  const sourceCenter = getRectCenter(source.rect)
  const targetCenter = getRectCenter(target.rect)

  const sourceAuto = getAutoAnchorFromRect(
    source.rect,
    sourceRotation,
    targetCenter
  )
  const targetAuto = getAutoAnchorFromRect(
    target.rect,
    targetRotation,
    sourceCenter
  )

  const sourceAnchor = edge.source.anchor ?? sourceAuto.anchor
  const targetAnchor = edge.target.anchor ?? targetAuto.anchor

  const sourcePoint = edge.source.anchor
    ? getAnchorPoint(source.rect, sourceAnchor, sourceRotation)
    : sourceAuto.point
  const targetPoint = edge.target.anchor
    ? getAnchorPoint(target.rect, targetAnchor, targetRotation)
    : targetAuto.point

  return {
    source: {
      nodeId: edge.source.nodeId,
      anchor: sourceAnchor,
      point: sourcePoint
    },
    target: {
      nodeId: edge.target.nodeId,
      anchor: targetAnchor,
      point: targetPoint
    }
  }
}
