import type { GraphChange } from '@engine-types/graph'

export const hasProjectionChange = (change: GraphChange) =>
  change.projection.visibleNodesChanged ||
  change.projection.canvasNodesChanged ||
  change.projection.visibleEdgesChanged
