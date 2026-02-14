import { useAtomValue } from 'jotai'
import { docAtom } from '@whiteboard/engine'

export const useDoc = () => useAtomValue(docAtom)
