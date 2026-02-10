import { useInstanceAtomValue } from '../../common/hooks'
import { visibleEdgesAtom } from '../../common/state/whiteboardDerivedAtoms'

export const useVisibleEdges = () => useInstanceAtomValue(visibleEdgesAtom)
