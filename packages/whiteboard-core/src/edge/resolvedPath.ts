import type { Edge, Rect } from '../types/core'
import { getEdgePath } from './path'
import {
  resolveEdgeEnds,
  type ResolvedEdgeEnds
} from './endpoints'
import type { EdgePathResult } from './types'

export type ResolveEdgePathFromRectsInput = {
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

export type ResolvedEdgePathFromRects = {
  ends: ResolvedEdgeEnds
  path: EdgePathResult
}

export const resolveEdgePathFromRects = ({
  edge,
  source,
  target
}: ResolveEdgePathFromRectsInput): ResolvedEdgePathFromRects => {
  const ends = resolveEdgeEnds({
    edge,
    source,
    target
  })
  if (!ends) {
    throw new Error(`Unable to resolve edge path for ${edge.id}.`)
  }
  const path = getEdgePath({
    edge,
    source: {
      point: ends.source.point,
      side: ends.source.anchor?.side
    },
    target: {
      point: ends.target.point,
      side: ends.target.anchor?.side
    }
  })
  return {
    ends,
    path
  }
}
