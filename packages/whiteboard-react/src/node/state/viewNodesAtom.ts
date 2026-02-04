import { atom } from 'jotai'
import type { Node } from '@whiteboard/core'

export const viewNodesAtom = atom<Node[] | null>(null)
