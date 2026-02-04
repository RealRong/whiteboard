import { atom } from 'jotai'
import type { UseSelectionReturn } from '../hooks/useSelection'

export const selectionApiAtom = atom<UseSelectionReturn | null>(null)
