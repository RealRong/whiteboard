import { atom } from 'jotai'
import type { NodeId } from '@whiteboard/core'

export const groupHoveredAtom = atom<NodeId | undefined>(undefined)
