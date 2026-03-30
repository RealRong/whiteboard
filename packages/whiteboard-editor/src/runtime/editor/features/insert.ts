import { createInsertPresetInteraction } from '../../../features/insert/interaction'
import type { EditorFeatureContext } from '../../../types/runtime/editor/featureContext'

export const createInsertFeature = (
  ctx: EditorFeatureContext
 ) => ({
  interaction: 
    createInsertPresetInteraction({
      commands: ctx.commands,
      read: ctx.read
    })
})
