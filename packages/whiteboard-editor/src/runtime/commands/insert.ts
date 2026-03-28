import type { Editor } from '../editor/types'
import {
  DEFAULT_MINDMAP_PRESET_KEY,
  DEFAULT_STICKY_PRESET_KEY,
  FRAME_INSERT_PRESET,
  TEXT_INSERT_PRESET,
  getInsertPreset
} from '../../features/toolbox/presets'
import {
  insertPreset as insertPresetAction
} from '../../features/toolbox/insert'

type EditorCommandHost = Pick<Editor, 'commands' | 'read' | 'state' | 'viewport'>

export const createInsertCommands = ({
  commandHost
}: {
  commandHost: EditorCommandHost
}): Editor['commands']['insert'] => {
  const insertPreset = (
    presetKey: string,
    options: {
      at: { x: number; y: number }
      ownerId?: string
    }
  ) => {
    const preset = getInsertPreset(presetKey)
    if (!preset) {
      return undefined
    }

    return insertPresetAction({
      editor: commandHost,
      preset,
      world: options.at,
      ownerId: options.ownerId
    })
  }

  return {
    preset: (preset, options) => insertPreset(preset, options),
    text: (options) => insertPreset(TEXT_INSERT_PRESET.key, options),
    frame: (options) => insertPreset(FRAME_INSERT_PRESET.key, options),
    sticky: ({ toneKey = DEFAULT_STICKY_PRESET_KEY, at, ownerId }) =>
      insertPreset(toneKey, { at, ownerId }),
    shape: ({ kind, at, ownerId }) =>
      insertPreset(`shape.${kind}`, { at, ownerId }),
    mindmap: ({ templateKey = DEFAULT_MINDMAP_PRESET_KEY, at }) =>
      insertPreset(templateKey, { at })
  }
}
