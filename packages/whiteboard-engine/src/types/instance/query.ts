import type { NodeId, Point, Rect } from '@whiteboard/core'
import type { SnapCandidate } from '../node/snap'
import type {
  CanvasNodeRect,
  EdgeConnectAnchorResult
} from './view'

export type QueryDebugMetric = {
  rebuildCount: number
  cacheHitCount: number
  cacheMissCount: number
  cacheHitRate: number
  lastRebuildMs: number
  avgRebuildMs: number
  maxRebuildMs: number
  totalRebuildMs: number
  lastRebuiltAt?: number
}

export type QueryDebugSnapshot = {
  canvas: QueryDebugMetric
  snap: QueryDebugMetric
}

export type QueryDebug = {
  getMetrics: () => QueryDebugSnapshot
  resetMetrics: (target?: keyof QueryDebugSnapshot) => void
}

export type QueryCanvas = {
  nodeRects: () => CanvasNodeRect[]
  nodeRect: (nodeId: NodeId) => CanvasNodeRect | undefined
  watchNodes: (listener: (nodeIds: NodeId[]) => void) => () => void
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
  debug: QueryDebug
}
