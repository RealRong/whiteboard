import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { EdgeChange, IndexChange } from './change'

export type InvalidationMode = 'none' | 'partial' | 'full'

export type InvalidationRevision = {
  from: number
  to: number
}

export type ReadInvalidation = {
  mode: InvalidationMode
  revision: InvalidationRevision
  dirtyNodeIds: readonly NodeId[]
  dirtyEdgeIds: readonly EdgeId[]
  index: IndexChange
  edge: EdgeChange
}
