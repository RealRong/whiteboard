import { useAtomValue, useSetAtom } from 'jotai'
import type { InteractionState } from '../state/whiteboardAtoms'
import { interactionAtom } from '../state/whiteboardAtoms'

export const useInteraction = () => {
  const state = useAtomValue(interactionAtom)
  const setState = useSetAtom(interactionAtom)
  const update = (patch: Partial<InteractionState>) => {
    setState((prev) => ({
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
    }))
  }
  return { state, update }
}
