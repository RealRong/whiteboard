import type { Edge, Point } from '@whiteboard/core'
import type { EdgeConnectState } from '@whiteboard/engine'

export type EdgePathEntry = {
  id: string
  edge: Edge
  path: {
    points: Point[]
    svgPath: string
  }
}

export type UseEdgeGeometryOptions = {
  edges: Edge[]
  connectState?: EdgeConnectState
}
