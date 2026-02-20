import type { GraphChangeView } from './change'

export const hasDirtyNodeHints = (change: GraphChangeView) =>
  Boolean(change.dirtyNodeIds?.length)

export const shouldSyncCanvasNodes = (change: GraphChangeView) =>
  change.fullSync ||
  change.canvasNodesChanged ||
  hasDirtyNodeHints(change) ||
  Boolean(change.orderChanged)

export const shouldSyncDerivedEdgePaths = (change: GraphChangeView) =>
  change.fullSync || change.canvasNodesChanged || change.visibleEdgesChanged

export const shouldSyncDerivedMindmapTrees = (change: GraphChangeView) =>
  change.fullSync || change.visibleNodesChanged

export const shouldResetEdgePathCache = (change: GraphChangeView) =>
  change.fullSync || change.canvasNodesChanged || change.visibleEdgesChanged

export const toProjectionInvalidation = (change: GraphChangeView) => ({
  visibleNodes: change.fullSync || change.visibleNodesChanged,
  canvasNodes: change.fullSync || change.canvasNodesChanged,
  visibleEdges: change.fullSync || change.visibleEdgesChanged
})
