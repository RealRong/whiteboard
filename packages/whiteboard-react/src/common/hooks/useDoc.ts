import { useAtomValue } from 'jotai'
import { docAtom } from '../state/whiteboardContextAtoms'

export const useDoc = () => useAtomValue(docAtom)
