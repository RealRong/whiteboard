import { spacePressedAtom } from '../state/whiteboardAtoms'
import { useInstanceAtomValue } from './useInstanceStore'

export const useSpacePressed = () => useInstanceAtomValue(spacePressedAtom)
