import { useCallback } from 'react'
import { useAtomValue, useSetAtom } from 'jotai'
import type { InteractionState } from '../state/whiteboardAtoms'
import { interactionAtom } from '../state/whiteboardAtoms'

export const useInteractionState = () => {
  return useAtomValue(interactionAtom)
}

export const useInteractionActions = () => {
  const setState = useSetAtom(interactionAtom)

  const update = useCallback(
    (patch: Partial<InteractionState>) => {
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
    },
    [setState]
  )

  return { update }
}

export const useInteraction = () => {
  const state = useInteractionState()
  const actions = useInteractionActions()

  return {
    state,
    ...actions
  }
}

export const interaction = {
  useState: useInteractionState,
  useActions: useInteractionActions
}
