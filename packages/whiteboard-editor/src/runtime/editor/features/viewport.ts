import { createViewportPanInteraction } from '../../../features/viewport/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createViewportFeature = (
  ctx: EditorFeatureContext
 ) => ({
  interaction: createViewportPanInteraction(ctx)
})
