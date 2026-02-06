import { useAtomValue } from 'jotai'
import { edgeConnectRuntimeAtom } from '../state/edgeConnectRuntimeAtom'

export const useEdgeConnectRuntime = () => useAtomValue(edgeConnectRuntimeAtom)
