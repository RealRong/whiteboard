import type { EdgeAnchor, EdgeId, Point } from '@whiteboard/core/types'

type EdgeConnectFrom = {
  nodeId: string
  anchor: EdgeAnchor
}

type EdgeConnectTo = {
  nodeId?: string
  anchor?: EdgeAnchor
  pointWorld?: Point
}

type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectDraft = {
  pointerId: number
  from: EdgeConnectFrom
  to?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
}
