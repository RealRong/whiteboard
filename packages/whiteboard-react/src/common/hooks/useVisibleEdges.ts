import { useAtomValue } from 'jotai'
import { visibleEdgesAtom } from '../state/whiteboardDerivedAtoms'

export const useVisibleEdges = () => useAtomValue(visibleEdgesAtom)
