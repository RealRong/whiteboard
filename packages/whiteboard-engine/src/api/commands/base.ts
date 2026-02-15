import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { mergeInteractionPatch } from '../../state/internal/interactionState'

export const createBaseCommands = (
  instance: Instance
): Pick<Commands, 'tool' | 'keyboard' | 'history' | 'interaction'> => {
  const { core } = instance.runtime
  const { read, write } = instance.state

  return {
    tool: {
      set: (tool) => {
        write('tool', tool)
      }
    },
    keyboard: {
      setSpacePressed: (pressed) => {
        write('spacePressed', pressed)
      }
    },
    history: {
      configure: (config) => {
        core.commands.history.configure(config)
      },
      undo: () => {
        if (!read('history').canUndo) return false
        return core.commands.history.undo()
      },
      redo: () => {
        if (!read('history').canRedo) return false
        return core.commands.history.redo()
      },
      clear: () => {
        core.commands.history.clear()
      }
    },
    interaction: {
      update: (patch) => {
        write('interaction', (prev) => mergeInteractionPatch(prev, patch))
      },
      clearHover: () => {
        write('interaction', (prev) =>
          mergeInteractionPatch(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    }
  }
}
