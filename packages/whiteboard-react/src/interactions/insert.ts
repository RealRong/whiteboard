import {
  selectTool,
  type InsertPresetKey
} from '@whiteboard/editor'
import type { InteractionFeature } from './runtime'
import type { InteractionCtx } from './runtime/ctx'

export const createInsertInteraction = (
  editor: Pick<InteractionCtx, 'read' | 'commands'>
): InteractionFeature => ({
  owner: {
    key: 'insert.preset',
    priority: 700,
    start: (start) => {
      const tool = editor.read.tool.get()

      if (
        tool.type !== 'insert'
        || start.pick.kind !== 'background'
        || !tool.preset
        || start.editable
        || start.ignoreInput
        || start.ignoreSelection
      ) {
        return null
      }

      const presetKey = tool.preset as InsertPresetKey
      const result = editor.commands.insert.preset(presetKey, {
        at: start.world
      })
      if (result) {
        editor.commands.tool.set(selectTool())
      }

      return {
        kind: 'handled'
      }
    }
  }
})
