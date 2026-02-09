import type { EdgeAnchor, Node, Point, Rect } from '@whiteboard/core'
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react'
import type { EdgeConnectState } from '../state'

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type UseEdgeConnectReturn = {
  state: EdgeConnectState
  selectedEdgeId?: string
  tool: 'select' | 'edge'
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  startFromHandle: (nodeId: string, side: EdgeAnchor['side'], pointerId?: number) => void
  startFromPoint: (nodeId: string, pointWorld: Point, pointerId?: number) => void
  startReconnect: (edgeId: string, end: 'source' | 'target', pointerId?: number) => void
  updateTo: (pointWorld: Point) => void
  commitTo: (pointWorld: Point) => void
  cancel: () => void
  selectEdge: (edgeId?: string) => void
  updateHover: (pointWorld: Point) => void
  handleNodePointerDown: (nodeId: string, pointWorld: Point, event: ReactPointerEvent<HTMLElement>) => boolean
  nodeRects: Array<{ node: Node; rect: Rect; aabb: Rect; rotation: number }>
  getAnchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
}

export type UseEdgeConnectStateReturn = Pick<
  UseEdgeConnectReturn,
  'state' | 'selectedEdgeId' | 'tool' | 'containerRef' | 'screenToWorld' | 'nodeRects' | 'getAnchorFromPoint'
>

export type UseEdgeConnectLayerStateReturn = Pick<UseEdgeConnectReturn, 'state' | 'selectedEdgeId'>

export type UseEdgeConnectActionsReturn = Pick<
  UseEdgeConnectReturn,
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
