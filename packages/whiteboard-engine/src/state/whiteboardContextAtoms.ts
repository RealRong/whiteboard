import { atom } from 'jotai'
import type { Document } from '@whiteboard/core'
import type { WhiteboardInstance } from '@engine-types/instance'

export const docAtom = atom<Document | null>(null)
export const instanceAtom = atom<WhiteboardInstance | null>(null)
