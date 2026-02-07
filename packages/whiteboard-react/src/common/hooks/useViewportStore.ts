import { useAtomValue } from 'jotai'
import { viewportZoomAtom } from '../state/whiteboardAtoms'

export const useViewportZoom = () => useAtomValue(viewportZoomAtom)
