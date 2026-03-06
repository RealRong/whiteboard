import type { NodeId, Rect } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '../instance/read'
import type { SnapCandidate } from '../node/snap'
import type { IndexChange } from './change'

export type CanvasQueryContext = {
  all: () => CanvasNodeRect[]
  byId: (nodeId: NodeId) => CanvasNodeRect | undefined
  idsInRect: (rect: Rect) => NodeId[]
}

export type SnapQueryContext = {
  all: () => SnapCandidate[]
  inRect: (rect: Rect) => SnapCandidate[]
}

export type IndexCanvasSource = Pick<CanvasQueryContext, 'all' | 'byId'>

export type Indexer = {
  query: {
    canvas: CanvasQueryContext
    snap: SnapQueryContext
  }
  applyChange: (change: IndexChange) => void
}
