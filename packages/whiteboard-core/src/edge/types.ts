import type { Edge, EdgeAnchor, Point } from '../types/core'

export type EdgeEndpoint = {
  point: Point
  side?: EdgeAnchor['side']
}

export type EdgePathInput = {
  edge: Edge
  source: EdgeEndpoint
  target: EdgeEndpoint
}

export type EdgePathResult = {
  points: Point[]
  svgPath: string
  label?: Point
}

export type EdgeRouter = (input: EdgePathInput) => EdgePathResult
