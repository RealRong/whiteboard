import { createSelectionPressInteraction } from '../../../features/selection/interaction'
import { createMarqueeRuntime } from '../../projection/marquee'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createSelectionFeature = (
  ctx: EditorFeatureContext
 ) => {
  const marquee = createMarqueeRuntime({
    read: ctx.read,
    viewport: ctx.viewport
  })
  const selectionPress = createSelectionPressInteraction(
    ctx,
    marquee
  )

  return {
    interaction: selectionPress.interaction,
    marquee: {
      rect: marquee.rect,
      match: marquee.match
    },
    clear: selectionPress.clear
  }
}
