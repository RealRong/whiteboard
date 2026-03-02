import type { NodeId } from '@whiteboard/core/types'

export type EdgeChange = {
  resetVisibleEdges: boolean
  clearPendingDirtyNodeIds: boolean
  appendDirtyNodeIds: readonly NodeId[]
}

export type IndexChange = {
  mode: 'none' | 'full' | 'dirtyNodeIds'
  dirtyNodeIds: readonly NodeId[]
}

export type ChangePlan = {
  index: IndexChange
  edge: EdgeChange
}
