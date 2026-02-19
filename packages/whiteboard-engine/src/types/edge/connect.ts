import type { EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import type { PointerInput } from '../common'
import type { EdgeConnectState } from './state'
import type { RefLike } from '../ui'

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type EdgeConnectModel = {
  state: EdgeConnectState
  selectedEdgeId?: string
  tool: 'select' | 'edge'
  containerRef?: RefLike<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  startFromHandle: (nodeId: string, side: EdgeAnchor['side'], pointer: PointerInput) => void
  startFromPoint: (nodeId: string, pointer: PointerInput) => void
  startReconnect: (edgeId: string, end: 'source' | 'target', pointer: PointerInput) => void
  updateTo: (pointer: PointerInput) => void
  commitTo: (pointer: PointerInput) => void
  cancel: () => void
  selectEdge: (edgeId?: string) => void
  handleNodePointerDown: (nodeId: string, pointer: PointerInput) => boolean
  nodeRects: Array<{ node: Node; rect: Rect; aabb: Rect; rotation: number }>
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
}

export type EdgeConnectLayerState = Pick<EdgeConnectModel, 'state' | 'selectedEdgeId'>

export type EdgeConnectActions = Pick<
  EdgeConnectModel,
  | 'startFromHandle'
  | 'startFromPoint'
  | 'startReconnect'
  | 'updateTo'
  | 'commitTo'
  | 'cancel'
  | 'selectEdge'
  | 'handleNodePointerDown'
>
