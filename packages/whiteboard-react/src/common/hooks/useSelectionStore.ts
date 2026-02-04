import { useAtomValue } from 'jotai'
import { selectionAtom } from '../state/whiteboardAtoms'

export const useSelectionStore = () => useAtomValue(selectionAtom)
