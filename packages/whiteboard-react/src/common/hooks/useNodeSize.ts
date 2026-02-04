import { useAtomValue } from 'jotai'
import { nodeSizeAtom } from '../state/whiteboardInputAtoms'

export const useNodeSize = () => useAtomValue(nodeSizeAtom)
