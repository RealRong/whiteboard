import { useAtomValue } from 'jotai'
import { nodeMapAtom } from '../state/whiteboardDerivedAtoms'

export const useNodeMap = () => useAtomValue(nodeMapAtom)
