import type { EdgeAnchor, EdgeId, Node, Point, Rect } from '@whiteboard/core/types'
import type { RefObject } from 'react'

export type PointerModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export type PointerInput = {
  pointerId: number
  button: 0 | 1 | 2
  client: Point
  screen: Point
  world: Point
  modifiers: PointerModifiers
}

export type EdgeConnectFrom = {
  nodeId: string
  anchor: EdgeAnchor
}

export type EdgeConnectTo = {
  nodeId?: string
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

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type EdgeConnectModel = {
  state: EdgeConnectState
  selectedEdgeId?: string
  tool: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  beginFromHandle: (nodeId: string, side: EdgeAnchor['side'], pointer: PointerInput) => EdgeConnectDraft | undefined
  beginFromNode: (nodeId: string, pointer: PointerInput) => EdgeConnectDraft | undefined
  beginReconnect: (edgeId: EdgeId, end: 'source' | 'target', pointer: PointerInput) => EdgeConnectDraft | undefined
  updateDraft: (draft: EdgeConnectDraft, pointer: PointerInput) => boolean
  commitDraft: (draft: EdgeConnectDraft) => boolean
  cancelDraft: (draft?: EdgeConnectDraft) => boolean
  selectEdge: (edgeId?: string) => void
  nodeRects: Array<{ node: Node; rect: Rect; aabb: Rect; rotation: number }>
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
}

export type EdgeConnectActions = Pick<
  EdgeConnectModel,
  | 'beginFromHandle'
  | 'beginFromNode'
  | 'beginReconnect'
  | 'updateDraft'
  | 'commitDraft'
  | 'cancelDraft'
  | 'selectEdge'
>
