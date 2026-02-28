import type { Edge, Rect } from '../types/core'
import { getEdgePath } from './path'
import {
  resolveEdgeEndpoints,
  type ResolvedEdgeEndpoints
} from './endpoints'
import type { EdgePathResult } from './types'

export type ResolveEdgePathFromRectsInput = {
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

export type ResolvedEdgePathFromRects = {
  endpoints: ResolvedEdgeEndpoints
  path: EdgePathResult
}

export const resolveEdgePathFromRects = ({
  edge,
  source,
  target
}: ResolveEdgePathFromRectsInput): ResolvedEdgePathFromRects => {
  const endpoints = resolveEdgeEndpoints({
    edge,
    source,
    target
  })
  const path = getEdgePath({
    edge,
    source: {
      point: endpoints.source.point,
      side: endpoints.source.anchor.side
    },
    target: {
      point: endpoints.target.point,
      side: endpoints.target.anchor.side
    }
  })
  return {
    endpoints,
    path
  }
}
