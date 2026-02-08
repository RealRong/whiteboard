import { nodeMapAtom } from '../state/whiteboardDerivedAtoms'
import { useInstanceAtomValue } from './useInstanceStore'

export const useNodeMap = () => useInstanceAtomValue(nodeMapAtom)
