import type { EdgeId } from '@whiteboard/core/types'
import type {
  EdgeEndpoints,
  EdgePathEntry,
  EngineReadGetters
} from '../instance/read'
import type { EdgeChange, ChangePlan } from './change'

export type EdgeReadSnapshot = {
  readonly ids: EdgeId[]
  readonly byId: Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

export type EdgeReadCache = {
  applyPlan: (plan: EdgeChange) => void
  getSnapshot: () => EdgeReadSnapshot
}

export type EdgeReadRuntime = {
  get: Pick<
    EngineReadGetters,
    'edgeIds' | 'edgeById' | 'selectedEdgeId' | 'edgeSelectedEndpoints'
  >
  applyChange: (plan: ChangePlan) => void
}
