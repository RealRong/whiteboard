import type { EdgeId, NodeId } from '@whiteboard/core/types'

export type MutationImpact = {
  tags: ReadonlySet<MutationImpactTag>
  dirtyNodeIds?: readonly NodeId[]
  dirtyEdgeIds?: readonly EdgeId[]
}

export type MutationImpactTag =
  | 'full'
  | 'nodes'
  | 'edges'
  | 'order'
  | 'geometry'
  | 'mindmap'
  | 'viewport'

export type Analyzer = {
  analyze: (operations: readonly import('@whiteboard/core/types').Operation[]) => MutationImpact
}

export type NodePatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}

export type EdgePatchClass = {
  affectsGeometry: boolean
  affectsOrder: boolean
  affectsStyleOnly: boolean
}
