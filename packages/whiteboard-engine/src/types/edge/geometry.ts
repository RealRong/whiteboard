import type { Edge, Point } from '@whiteboard/core'
import type { EdgeConnectState } from '../state'

export type EdgePathEntry = {
  id: string
  edge: Edge
  path: {
    points: Point[]
    svgPath: string
  }
}

export type EdgeGeometryOptions = {
  edges: Edge[]
  connectState?: EdgeConnectState
}
