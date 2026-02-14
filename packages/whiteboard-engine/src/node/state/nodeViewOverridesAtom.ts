import { atom } from 'jotai'
import type { NodeId } from '@whiteboard/core'
import type { NodeOverride } from '@engine-types/state'

export const nodeViewOverridesAtom = atom<Map<NodeId, NodeOverride>>(new Map())
