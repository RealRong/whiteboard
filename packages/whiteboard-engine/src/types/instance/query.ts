import type { Document, NodeId, Point, Rect, Viewport } from '@whiteboard/core/types'
import type { SnapCandidate } from '../node/snap'
import type { Size } from '../common'
import type { InstanceConfig } from './config'
import type {
  CanvasNodeRect,
  EdgeConnectAnchorResult
} from './read'

export type QueryCanvas = {
  nodeRects: () => CanvasNodeRect[]
  nodeRect: (nodeId: NodeId) => CanvasNodeRect | undefined
  nodeIdsInRect: (rect: Rect) => NodeId[]
}

export type QuerySnap = {
  candidates: () => SnapCandidate[]
  candidatesInRect: (rect: Rect) => SnapCandidate[]
}

export type QueryGeometry = {
  anchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
  nearestEdgeSegment: (pointWorld: Point, pathPoints: Point[]) => number
}

export type QueryDocument = {
  get: () => Document
}

export type QueryViewport = {
  get: () => Viewport
  getZoom: () => number
  screenToWorld: (point: Point) => Point
  worldToScreen: (point: Point) => Point
  clientToScreen: (clientX: number, clientY: number) => Point
  clientToWorld: (clientX: number, clientY: number) => Point
  getScreenCenter: () => Point
  getContainerSize: () => Size
}

export type QueryConfig = {
  get: () => InstanceConfig
}

export type Query = {
  doc: QueryDocument
  viewport: QueryViewport
  config: QueryConfig
  canvas: QueryCanvas
  snap: QuerySnap
  geometry: QueryGeometry
}
