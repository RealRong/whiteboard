import { atom } from 'jotai'
import type { Guide } from '../utils/snap'

export const dragGuidesAtom = atom<Guide[]>([])
