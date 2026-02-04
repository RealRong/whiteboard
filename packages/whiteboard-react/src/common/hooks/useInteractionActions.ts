import { useSetAtom } from 'jotai'
import { updateInteractionAtom } from '../state/whiteboardAtoms'

export const useInteractionActions = () => {
  const updateInteraction = useSetAtom(updateInteractionAtom)
  return { updateInteraction }
}
