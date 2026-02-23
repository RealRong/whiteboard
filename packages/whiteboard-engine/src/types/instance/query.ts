import type { NodeId, Point, Rect } from '@whiteboard/core/types'
import type { SnapCandidate } from '../node/snap'
import type {
  CanvasNodeRect,
  EdgeConnectAnchorResult
} from './view'

export type QueryCanvas = {
  nodeRects: () => CanvasNodeRect[]
  nodeRect: (nodeId: NodeId) => CanvasNodeRect | undefined
  nodeIdsInRect: (rect: Rect) => NodeId[]
  isBackgroundTarget: (target: EventTarget | null) => boolean
}

export type QuerySnap = {
  candidates: () => SnapCandidate[]
  candidatesInRect: (rect: Rect) => SnapCandidate[]
}

export type QueryGeometry = {
  anchorFromPoint: (rect: Rect, rotation: number, point: Point) => EdgeConnectAnchorResult
  nearestEdgeSegment: (pointWorld: Point, pathPoints: Point[]) => number
}

export type Query = {
  canvas: QueryCanvas
  snap: QuerySnap
  geometry: QueryGeometry
}
