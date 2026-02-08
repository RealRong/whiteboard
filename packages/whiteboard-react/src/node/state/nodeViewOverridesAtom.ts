import { atom } from 'jotai'
import type { NodeId } from '@whiteboard/core'
import type { NodeOverride } from 'types/state'

export const nodeViewOverridesAtom = atom<Map<NodeId, NodeOverride>>(new Map())

export const nodeViewOverridesTransientAtom = nodeViewOverridesAtom

