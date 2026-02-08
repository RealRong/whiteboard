import { atom } from 'jotai'
import type { Guide } from 'types/node/snap'

export const dragGuidesAtom = atom<Guide[]>([])

export const dragGuidesTransientAtom = dragGuidesAtom
