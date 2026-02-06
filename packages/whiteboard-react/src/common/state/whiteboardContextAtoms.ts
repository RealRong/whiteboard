import { atom } from 'jotai'
import type { Document } from '@whiteboard/core'
import type { WhiteboardInstance } from '../instance/whiteboardInstance'

export const docAtom = atom<Document | null>(null)
export const instanceAtom = atom<WhiteboardInstance | null>(null)
