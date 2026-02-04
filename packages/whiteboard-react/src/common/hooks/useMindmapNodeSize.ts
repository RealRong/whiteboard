import { useAtomValue } from 'jotai'
import { mindmapNodeSizeAtom } from '../state/whiteboardInputAtoms'

export const useMindmapNodeSize = () => useAtomValue(mindmapNodeSizeAtom)
