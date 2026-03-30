import { createSelectionPressInteraction } from '../../../features/selection/interaction'
import { createMarqueeInteraction } from '../../../features/selection/marquee'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createSelectionFeature = (
  ctx: EditorFeatureContext
 ) => {
  const marquee = createMarqueeInteraction({
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
