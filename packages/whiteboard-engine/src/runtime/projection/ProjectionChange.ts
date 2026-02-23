import type { ProjectionChange } from '@engine-types/projection'

export const hasProjectionChange = (change: ProjectionChange) =>
  change.projection.visibleNodesChanged ||
  change.projection.canvasNodesChanged ||
  change.projection.visibleEdgesChanged
