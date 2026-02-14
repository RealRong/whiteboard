import { atom } from 'jotai'
import type { Guide } from '@engine-types/node/snap'

export const dragGuidesAtom = atom<Guide[]>([])
