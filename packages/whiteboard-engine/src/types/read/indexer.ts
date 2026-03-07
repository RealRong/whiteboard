import type { NodeId, Rect } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '../instance/read'
import type { SnapCandidate } from '../node/snap'

export type CanvasQueryContext = {
  all: () => CanvasNodeRect[]
  byId: (nodeId: NodeId) => CanvasNodeRect | undefined
  idsInRect: (rect: Rect) => NodeId[]
}

export type SnapQueryContext = {
  all: () => SnapCandidate[]
  inRect: (rect: Rect) => SnapCandidate[]
}

export type ReadIndexes = {
  canvas: CanvasQueryContext
  snap: SnapQueryContext
}

export type IndexCanvasSource = Pick<CanvasQueryContext, 'all' | 'byId'>
