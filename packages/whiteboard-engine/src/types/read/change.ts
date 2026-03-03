import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type EdgeChange = {
  resetVisibleEdges: boolean
  clearPendingDirtyNodeIds: boolean
  appendDirtyNodeIds: readonly NodeId[]
  appendDirtyEdgeIds: readonly EdgeId[]
}

export type IndexChange = {
  mode: 'none' | 'full' | 'dirtyNodeIds'
  dirtyNodeIds: readonly NodeId[]
}
