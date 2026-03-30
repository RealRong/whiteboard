import { createNodeTransformInteraction } from '../../../features/node/transform/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createNodeFeature = (
  ctx: EditorFeatureContext
 ) => {
  const transform = createNodeTransformInteraction(ctx)
  const clear = () => {
    transform.clear()
    ctx.projection.node.clear()
  }

  return {
    interaction: transform.interaction,
    clear
  }
}
