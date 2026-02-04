import { useAtomValue } from 'jotai'
import { viewGraphAtom } from '../state/whiteboardDerivedAtoms'

export const useViewGraph = () => useAtomValue(viewGraphAtom)
