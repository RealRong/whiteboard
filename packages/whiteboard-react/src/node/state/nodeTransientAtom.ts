import { atom } from 'jotai'
import type { NodeTransientApi } from '../hooks/useNodeViewState'

export const nodeTransientAtom = atom<NodeTransientApi | null>(null)
