import { useAtomValue } from 'jotai'
import { canvasNodesAtom } from '../state/whiteboardDerivedAtoms'

export const useCanvasNodes = () => useAtomValue(canvasNodesAtom)
