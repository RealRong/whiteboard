import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core/types'
import type { PointerInput } from './common'

export type EdgeConnectFrom = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

export type EdgeConnectTo = {
  nodeId?: NodeId
  anchor?: EdgeAnchor
  pointWorld?: Point
}

export type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  from?: EdgeConnectFrom
  to?: EdgeConnectTo
  hover?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
}

export type EdgeConnectDraft = {
  pointerId: number
  from: EdgeConnectFrom
  to?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
}

export type RoutingDragPayload = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export type RoutingDragState = {
  payload?: RoutingDragPayload
}

export type RoutingDragStartOptions = {
  edgeId: EdgeId
  index: number
  pointer: PointerInput
}

export type RoutingDragUpdateOptions = {
  pointer: PointerInput
}

export type RoutingDragEndOptions = {
  pointer: PointerInput
}

export type RoutingDragCancelOptions = {
  pointer?: PointerInput
}
