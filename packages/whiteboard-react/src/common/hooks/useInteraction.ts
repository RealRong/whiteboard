import { useMemo } from 'react'
import type { InteractionState } from 'types/state'
import { interactionAtom } from '../state/whiteboardAtoms'
import { useInstance } from './useInstance'
import { useInstanceAtomValue } from './useInstanceStore'

export const useInteractionState = () => {
  return useInstanceAtomValue(interactionAtom)
}

export const useInteraction = () => {
  const instance = useInstance()
  const state = useInteractionState()

  return useMemo(
    () => ({
      state,
      update: (patch: Partial<InteractionState>) => instance.api.interaction.update(patch)
    }),
    [instance, state]
  )
}
