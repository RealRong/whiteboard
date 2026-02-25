import type { EdgeAnchor, EdgeId, Node, Point, Rect } from '@whiteboard/core/types'
import type { RefObject } from 'react'
import type { EdgeConnectDraft, EdgeConnectState, PointerInput } from '@whiteboard/engine'

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
