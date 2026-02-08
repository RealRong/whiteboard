import type { InteractionState } from 'types/state'

export const mergeInteractionPatch = (prev: InteractionState, patch: Partial<InteractionState>): InteractionState => ({
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
