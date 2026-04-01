import type { TransformInteractionCtx, TransformProjection } from './types'
import {
  clearSelectionPreview,
  writeSelectionTransformPreview
} from '../selection/overlay'

export const clearTransformOverlay = (
  ctx: TransformInteractionCtx
) => {
  clearSelectionPreview(ctx)
}

export const writeTransformProjection = (
  ctx: TransformInteractionCtx,
  projection: TransformProjection
) => {
  writeSelectionTransformPreview(ctx, projection)
}
