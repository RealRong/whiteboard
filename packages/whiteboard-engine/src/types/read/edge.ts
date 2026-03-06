import type { EdgeId } from '@whiteboard/core/types'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgesView
} from '../instance/read'
import type { EdgeChange } from './change'

export type EdgeReadSnapshot = {
  readonly ids: EdgeId[]
  readonly byId: Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

export type EdgeReadCache = {
  applyChange: (change: EdgeChange) => void
  getSnapshot: () => EdgeReadSnapshot
}

export type EdgeRead = {
  get: {
    edge: () => EdgesView
  }
  applyChange: (change: EdgeChange) => void
}
