import type { Edge, Point } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/view'
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
