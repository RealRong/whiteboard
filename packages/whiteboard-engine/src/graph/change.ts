import type { NodeId } from '@whiteboard/core'
import type { GraphChange } from '@engine-types/graph'

export type GraphChangeView = {
  source: GraphChange['source']
  fullSync: boolean
  visibleNodesChanged: boolean
  canvasNodesChanged: boolean
  visibleEdgesChanged: boolean
  dirtyNodeIds?: NodeId[]
  orderChanged?: true
}

export const toChangeView = (change: GraphChange): GraphChangeView => ({
  source: change.source,
  fullSync: change.kind === 'full',
  visibleNodesChanged: change.projection.visibleNodesChanged,
  canvasNodesChanged: change.projection.canvasNodesChanged,
  visibleEdgesChanged: change.projection.visibleEdgesChanged,
  dirtyNodeIds: change.kind === 'partial' ? change.dirtyNodeIds : undefined,
  orderChanged: change.kind === 'partial' ? change.orderChanged : undefined
})

export const hasProjectionChange = (change: GraphChange) =>
  change.projection.visibleNodesChanged ||
  change.projection.canvasNodesChanged ||
  change.projection.visibleEdgesChanged
