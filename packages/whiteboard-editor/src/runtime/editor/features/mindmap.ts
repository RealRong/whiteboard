import { createMindmapDragInteraction } from '../../../features/mindmap/drag/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createMindmapFeature = (
  ctx: EditorFeatureContext
 ) => {
  const mindmapDrag = createMindmapDragInteraction(ctx)

  return {
    interaction: mindmapDrag.interaction,
    clear: mindmapDrag.clear
  }
}
