import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { EdgeChange, IndexChange } from './change'

export type InvalidationMode = 'none' | 'partial' | 'full'

export type InvalidationReason =
  | 'replace'
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type InvalidationRevision = {
  from: number
  to: number
}

export type ReadInvalidation = {
  mode: InvalidationMode
  reasons: readonly InvalidationReason[]
  revision: InvalidationRevision
  dirtyNodeIds: readonly NodeId[]
  dirtyEdgeIds: readonly EdgeId[]
  index: IndexChange
  edge: EdgeChange
}
