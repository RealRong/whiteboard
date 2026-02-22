import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeHistory } from '@engine-types/instance/runtime'
import type { InteractionState } from '@engine-types/state'
import type { DispatchResult, Document } from '@whiteboard/core/types'

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
  instance: InternalInstance,
  history: RuntimeHistory,
  resetDoc: (doc: Document) => Promise<DispatchResult>
): Pick<Commands, 'doc' | 'tool' | 'keyboard' | 'history' | 'interaction'> => {
  const { read, write } = instance.state

  return {
    doc: {
      reset: (doc) => resetDoc(doc)
    },
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
        history.configure(config)
      },
      undo: () => {
        if (!read('history').canUndo) return false
        return history.undo()
      },
      redo: () => {
        if (!read('history').canRedo) return false
        return history.redo()
      },
      clear: () => {
        history.clear()
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
