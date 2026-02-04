import { useAtomValue } from 'jotai'
import { whiteboardInputAtom } from '../state/whiteboardInputAtoms'

export const useWhiteboardInput = () => useAtomValue(whiteboardInputAtom)
