import type { PointerDown } from '../../runtime/input/pointer'
import type { InteractionRegistration } from '../../runtime/interaction'
import type { InsertPresetKey } from '../../types/tool'
import type { Editor } from '../../types/editor'

export const createInsertPresetInteraction = (
  editor: Pick<Editor, 'commands' | 'read'>
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
    const frameTargetId = input.frame.id ?? editor.read.node.frameAt(input.point.world)
    const result = editor.commands.insert.preset(state.presetKey, {
      at: input.point.world,
      ownerId: input.frame.id ?? frameTargetId
    })
    if (!result) {
      session.finish()
      return
    }

    editor.commands.tool.select()
    session.finish()
  }
})
