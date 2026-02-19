import type { Edge, EdgeId, Point } from '@whiteboard/core'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
import type { GraphChange, GraphSnapshot } from '@engine-types/graph'
import type { EdgeConnectState, EdgeReconnectInfo } from '@engine-types/state'

export type EdgeNodeRect = ReturnType<QueryCanvas['nodeRect']>
export type NodeRectReader = QueryCanvas['nodeRect']

export type EdgeConnectFrom = NonNullable<EdgeConnectState['from']>
export type EdgeConnectTo = NonNullable<EdgeConnectState['to']>

export type EdgeConnectPointInput = {
  nodeId?: EdgeConnectFrom['nodeId']
  anchor?: EdgeConnectFrom['anchor']
  pointWorld?: EdgeConnectTo['pointWorld']
}

export type EdgeConnectPreview = {
  from?: Point
  to?: Point
  hover?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

export type ReconnectPoint = {
  point: Point
  side?: NonNullable<EdgePathEntry['edge']['source']['anchor']>['side']
}

export type ResolveEndpoints = (edge: Edge) => EdgeEndpoints | undefined

export type EdgePathCacheEntry = {
  geometrySignature: string
  edge: EdgePathEntry['edge']
  path: EdgePathEntry['path']
  entry: EdgePathEntry
}

export type EdgePathStoreOptions = {
  readGraph: () => GraphSnapshot
  getNodeRect: NodeRectReader
  resolveEndpoints: ResolveEndpoints
  resolveReconnectPoint: (to: EdgeConnectState['to']) => ReconnectPoint | undefined
}

export type EdgePathStore = {
  syncGraph: (change: GraphChange) => void
  getEntries: () => EdgePathEntry[]
  getReconnectEntry: (edgeConnect: EdgeConnectState) => EdgePathEntry | undefined
  getEdge: (edgeId: EdgeId) => Edge | undefined
}
