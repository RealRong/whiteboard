import { createDrawInteraction } from '../../../features/draw/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createDrawFeature = (
  ctx: EditorFeatureContext
 ) => {
  const draw = createDrawInteraction(ctx)

  return {
    interactions: [...draw.interactions],
    preview: draw.preview,
    clear: draw.clear
  }
}
