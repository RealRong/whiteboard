import type { InteractionState } from '@engine-types/state'
import type { Commands } from '@engine-types/commands'
import type { InternalInstance } from '@engine-types/instance/instance'

type Options = {
  instance: Pick<InternalInstance, 'state'>
}

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

export const createInteractionCommands = ({ instance }: Options): Commands['interaction'] => {
  const update: Commands['interaction']['update'] = (patch) => {
    instance.state.write('interaction', (prev) => mergeInteraction(prev, patch))
  }

  const clearHover: Commands['interaction']['clearHover'] = () => {
    instance.state.write('interaction', (prev) =>
      mergeInteraction(prev, {
        hover: {
          nodeId: undefined,
          edgeId: undefined
        }
      })
    )
  }

  return {
    update,
    clearHover
  }
}

export type InteractionCommandsApi = ReturnType<typeof createInteractionCommands>
