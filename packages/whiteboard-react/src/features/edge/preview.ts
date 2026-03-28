import type { EdgeId, EdgePatch, Point } from '@whiteboard/core/types'
import type { InternalEditor } from '../../runtime/instance'

export type EdgePreview = InternalEditor['internals']['edge']['preview']
export type EdgePatchReader = EdgePreview['patch']
export type EdgeHint = ReturnType<EdgePreview['hint']['get']>
type EdgePreviewPatch = ReturnType<EdgePatchReader['get']>

export const EMPTY_PATCH = {} as EdgePreviewPatch

export const writeEdgePreviewPatch = (
  preview: EdgePreview,
  edgeId: EdgeId,
  patch: EdgePatch,
  activeRouteIndex?: number
) => {
  preview.writePatch(edgeId, patch, activeRouteIndex)
}

export const writeEdgePreviewRoute = (
  preview: EdgePreview,
  edgeId: EdgeId,
  points: readonly Point[],
  activeRouteIndex?: number
) => {
  preview.writeRoute(edgeId, points, activeRouteIndex)
}
