import type { Edge, EdgeAnchor, Point } from '../types/core'

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
