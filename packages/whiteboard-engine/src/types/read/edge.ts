import type { EdgeId } from '@whiteboard/core/types'
import type {
  EdgesView,
  EdgeEndpoints,
  EdgePathEntry
} from '../instance/read'
import type { EdgeChange } from './change'

export type EdgeReadSnapshot = {
  readonly ids: EdgeId[]
  readonly byId: Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

export type EdgeReadCache = {
  applyPlan: (plan: EdgeChange) => void
  getSnapshot: () => EdgeReadSnapshot
}

export type EdgeRead = {
  get: {
    edge: () => EdgesView
  }
  applyPlan: (plan: EdgeChange) => void
}
