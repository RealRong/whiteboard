import type { Edge, Node, Point } from '@whiteboard/core'
import type { EdgeConnectState } from '../state'
import type { Size } from '../common'

export type EdgePathEntry = {
  id: string
  edge: Edge
  path: {
    points: Point[]
    svgPath: string
  }
}

export type UseEdgeGeometryOptions = {
  nodes: Node[]
  edges: Edge[]
  nodeSize: Size
  connectState?: EdgeConnectState
}
