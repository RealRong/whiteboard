import { atom } from 'jotai'
import type { UseEdgeConnectReturn } from '../hooks/useEdgeConnect'

export const edgeConnectRuntimeAtom = atom<UseEdgeConnectReturn | null>(null)
