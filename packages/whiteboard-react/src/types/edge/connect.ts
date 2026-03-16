import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'

type EdgeConnectFrom = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

type EdgeConnectTo = {
  nodeId?: NodeId
  anchor?: EdgeAnchor
  pointWorld?: Point
}

type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  pointerId: number
  from: EdgeConnectFrom
  to?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
}
