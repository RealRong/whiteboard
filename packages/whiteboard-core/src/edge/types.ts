import type { Edge, EdgeAnchor, EdgeRoute, Point } from '../types/core'
import type { ResolvedEdgeEnd } from './endpoints'

export type EdgePathEnd = {
  point: Point
  side?: EdgeAnchor['side']
}

export type EdgePathInput = {
  edge: Edge
  source: EdgePathEnd
  target: EdgePathEnd
}

export type EdgePathSegment = {
  from: Point
  to: Point
  insertIndex: number
  insertPoint?: Point
  hitPoints?: readonly Point[]
}

export type EdgePathResult = {
  points: Point[]
  segments: EdgePathSegment[]
  svgPath: string
  label?: Point
}

export type EdgeRouter = (input: EdgePathInput) => EdgePathResult

export type EdgeHandle =
  | {
      kind: 'end'
      end: 'source' | 'target'
      point: Point
    }
  | {
      kind: 'anchor'
      index: number
      point: Point
      mode: 'fixed' | 'grow'
    }
  | {
      kind: 'insert'
      insertIndex: number
      point: Point
    }

export type EdgeView = {
  ends: {
    source: ResolvedEdgeEnd
    target: ResolvedEdgeEnd
  }
  path: EdgePathResult
  handles: readonly EdgeHandle[]
  can: {
    move: boolean
    reconnectSource: boolean
    reconnectTarget: boolean
    editRoute: boolean
  }
}

export const readEdgeRoutePoints = (
  route: EdgeRoute | undefined
): readonly Point[] => (
  route?.kind === 'manual'
    ? route.points
    : []
)
