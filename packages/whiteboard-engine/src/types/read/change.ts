import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type Rebuild = 'none' | 'dirty' | 'full'

export type IndexChange = {
  rebuild: Rebuild
  nodeIds: readonly NodeId[]
}

export type EdgeChange = {
  rebuild: Rebuild
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type ReadSignals = {
  node: boolean
  edge: boolean
  mindmap: boolean
}

export type ReadControl = {
  index: IndexChange
  edge: EdgeChange
  signals: ReadSignals
}
