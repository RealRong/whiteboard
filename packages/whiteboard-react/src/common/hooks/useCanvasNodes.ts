import { canvasNodesAtom } from '../state/whiteboardDerivedAtoms'
import { useInstanceAtomValue } from './useInstanceStore'

export const useCanvasNodes = () => useInstanceAtomValue(canvasNodesAtom)
