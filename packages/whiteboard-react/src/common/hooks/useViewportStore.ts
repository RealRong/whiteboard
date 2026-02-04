import { useAtomValue } from 'jotai'
import { viewportAtom } from '../state/whiteboardAtoms'

export const useViewportStore = () => useAtomValue(viewportAtom)
