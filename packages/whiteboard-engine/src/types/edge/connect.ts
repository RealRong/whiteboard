import type { EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
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
  startFromHandle: (nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => void
  startFromPoint: (nodeId: string, pointWorld: Point, pointerId?: number) => void
  startReconnect: (edgeId: string, end: 'source' | 'target', pointerId?: number) => void
  updateTo: (pointWorld: Point) => void
  commitTo: (pointWorld: Point) => void
  cancel: () => void
  selectEdge: (edgeId?: string) => void
  updateHover: (pointWorld: Point) => void
  handleNodePointerDown: (nodeId: string, pointWorld: Point, event: PointerEvent) => boolean
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
  | 'updateHover'
  | 'handleNodePointerDown'
>
