import { getAnchorPoint, getRectCenter } from '../geometry'
import type { Edge, EdgeAnchor, EdgeEnd, Point, Rect } from '../types/core'
import { isNodeEdgeEnd } from '../types/core'
import { getAutoAnchorFromRect } from './anchor'

export type ResolvedEdgeEnd = {
  end: EdgeEnd
  point: Point
  anchor?: EdgeAnchor
}

export type ResolvedEdgeEnds = {
  source: ResolvedEdgeEnd
  target: ResolvedEdgeEnd
}

type ResolveNodeEndInput = {
  end: Extract<EdgeEnd, { kind: 'node' }>
  node: {
    rect: Rect
    rotation?: number
  }
  otherPoint: Point
}

const resolveNodeEnd = ({
  end,
  node,
  otherPoint
}: ResolveNodeEndInput): ResolvedEdgeEnd => {
  const rotation = node.rotation ?? 0
  const auto = getAutoAnchorFromRect(
    node.rect,
    rotation,
    otherPoint
  )
  const anchor = end.anchor ?? auto.anchor
  const point = end.anchor
    ? getAnchorPoint(node.rect, anchor, rotation)
    : auto.point

  return {
    end,
    point,
    anchor
  }
}

const resolvePointEnd = (
  end: Extract<EdgeEnd, { kind: 'point' }>
): ResolvedEdgeEnd => ({
  end,
  point: end.point
})

export type ResolveEdgeEndsInput = {
  edge: Edge
  source?: {
    rect: Rect
    rotation?: number
  }
  target?: {
    rect: Rect
    rotation?: number
  }
}

export const resolveEdgeEnds = ({
  edge,
  source,
  target
}: ResolveEdgeEndsInput): ResolvedEdgeEnds | undefined => {
  const sourceRefPoint =
    isNodeEdgeEnd(edge.target)
      ? (target ? getRectCenter(target.rect) : undefined)
      : edge.target.point
  const targetRefPoint =
    isNodeEdgeEnd(edge.source)
      ? (source ? getRectCenter(source.rect) : undefined)
      : edge.source.point

  let resolvedSource: ResolvedEdgeEnd | undefined
  if (isNodeEdgeEnd(edge.source)) {
    if (!source || !sourceRefPoint) {
      return undefined
    }
    resolvedSource = resolveNodeEnd({
      end: edge.source,
      node: source,
      otherPoint: sourceRefPoint
    })
  } else {
    resolvedSource = resolvePointEnd(edge.source)
  }

  let resolvedTarget: ResolvedEdgeEnd | undefined
  if (isNodeEdgeEnd(edge.target)) {
    if (!target || !targetRefPoint) {
      return undefined
    }
    resolvedTarget = resolveNodeEnd({
      end: edge.target,
      node: target,
      otherPoint: targetRefPoint
    })
  } else {
    resolvedTarget = resolvePointEnd(edge.target)
  }

  return {
    source: resolvedSource,
    target: resolvedTarget
  }
}
