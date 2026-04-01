import type { PointerDown } from '../runtime/input/pointer'
import type { ActiveInteraction, InteractionRegistration } from '../runtime/interaction'
import type { InteractionCtx } from '../runtime/interaction/ctx'
import type { InsertPresetKey } from '../types/tool'
import { selectTool } from '../tool/model'

export const createInsertInteraction = (
  editor: Pick<InteractionCtx, 'read' | 'commands'>
): InteractionRegistration => ({
  key: 'insert.preset',
  priority: 700,
  start: (start: PointerDown, control): ActiveInteraction | null => {
    if (
      start.tool.type !== 'insert'
      || start.pick.kind !== 'background'
      || !start.tool.preset
      || start.editable
      || start.ignoreInput
      || start.ignoreSelection
    ) {
      return null
    }

    const presetKey = start.tool.preset as InsertPresetKey
    const result = editor.commands.insert.preset(presetKey, {
      at: start.point.world
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
