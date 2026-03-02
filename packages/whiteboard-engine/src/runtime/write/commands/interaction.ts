import type { InteractionState } from '@engine-types/state/model'
import type { Commands } from '@engine-types/command/api'
import type { InternalInstance } from '@engine-types/instance/engine'
import type { InteractionCommandsApi } from '@engine-types/write/commands'

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

export const interaction = ({
  instance
}: {
  instance: Pick<InternalInstance, 'state'>
}): InteractionCommandsApi => {
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
