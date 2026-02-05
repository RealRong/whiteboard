import { useAtomValue } from 'jotai'
import { spacePressedAtom } from '../state/whiteboardAtoms'

export const useSpacePressed = () => useAtomValue(spacePressedAtom)
