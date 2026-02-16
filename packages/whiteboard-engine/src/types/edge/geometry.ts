import type { Edge, EdgeId, Point } from '@whiteboard/core'
import type { EdgeConnectState } from './state'

export type EdgePath = {
  points: Point[]
  svgPath: string
}

export type EdgePathEntry = {
  id: EdgeId
  edge: Edge
  path: EdgePath
}

export type EdgeGeometryOptions = {
  edges: Edge[]
  connectState?: EdgeConnectState
}
