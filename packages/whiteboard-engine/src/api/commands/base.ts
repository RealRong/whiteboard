import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import type { InteractionState } from '@engine-types/state'

const mergeInteraction = (
  prev: InteractionState,
  patch: Partial<InteractionState>
): InteractionState => ({
  ...prev,
  ...patch,
  focus: patch.focus ? { ...prev.focus, ...patch.focus } : prev.focus,
  pointer: patch.pointer
    ? {
        ...prev.pointer,
        ...patch.pointer,
        modifiers: patch.pointer.modifiers
          ? { ...prev.pointer.modifiers, ...patch.pointer.modifiers }
          : prev.pointer.modifiers
      }
    : prev.pointer,
  hover: patch.hover ? { ...prev.hover, ...patch.hover } : prev.hover
})

export const createBase = (
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
        write('interaction', (prev) => mergeInteraction(prev, patch))
      },
      clearHover: () => {
        write('interaction', (prev) =>
          mergeInteraction(prev, { hover: { nodeId: undefined, edgeId: undefined } })
        )
      }
    }
  }
}
