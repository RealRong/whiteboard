import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type Rebuild = 'none' | 'dirty' | 'full'

export type EdgeChange = {
  rebuild: Rebuild
  dirtyNodeIds: readonly NodeId[]
  dirtyEdgeIds: readonly EdgeId[]
}

export type IndexChange = {
  rebuild: Rebuild
  dirtyNodeIds: readonly NodeId[]
}
