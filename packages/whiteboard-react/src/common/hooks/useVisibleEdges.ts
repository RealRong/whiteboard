import { visibleEdgesAtom } from '../state/whiteboardDerivedAtoms'
import { useInstanceAtomValue } from './useInstanceStore'

export const useVisibleEdges = () => useInstanceAtomValue(visibleEdgesAtom)
