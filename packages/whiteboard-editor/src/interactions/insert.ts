import type { PointerDown } from '../runtime/input/pointer'
import type { InteractionRegistration } from '../runtime/interaction'
import type { FeatureRuntime } from '../runtime/editor/createEditor'
import type { InsertPresetKey } from '../types/tool'
import { selectTool } from '../tool/model'

export const createInsertPresetInteraction = (
  editor: Pick<FeatureRuntime, 'query' | 'command'>
): InteractionRegistration<{
  presetKey: InsertPresetKey
}> => ({
  key: 'insert.preset',
  priority: 700,
  mode: 'press',
  can: (start: PointerDown) => {
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

    return {
      presetKey: start.tool.preset
    }
  },
  start: ({ input, state, session }) => {
    const result = editor.command.insert.preset(state.presetKey, {
      at: input.point.world
    })
    if (!result) {
      session.finish()
      return
    }

    editor.command.tool.set(selectTool())
    session.finish()
  }
})
