import type { InteractionOwner, InteractionSession } from '../runtime/interaction'
import type { InteractionCtx } from '../runtime/interaction/ctx'
import type { PointerDownInput } from '../types/input'
import type { InsertPresetKey } from '../types/tool'
import { selectTool } from '../tool/model'

export const createInsertInteraction = (
  editor: Pick<InteractionCtx, 'read' | 'commands'>
): InteractionOwner => ({
  key: 'insert.preset',
  priority: 700,
  start: (start: PointerDownInput, control): InteractionSession | null => {
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
    if (!result) {
      control.finish()
      return {
        mode: 'press'
      }
    }

    editor.commands.tool.set(selectTool())
    control.finish()
    return {
      mode: 'press'
    }
  }
})
