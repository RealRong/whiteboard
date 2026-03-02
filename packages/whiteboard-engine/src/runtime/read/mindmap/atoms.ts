import { atom, type Atom } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import {
  READ_PUBLIC_KEYS,
  READ_SUBSCRIBE_KEYS,
  type MindmapViewTree
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '../context'
import type { MindmapReadCache } from './cache'

export type MindmapReadAtoms = {
  mindmapIds: Atom<NodeId[]>
  mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
}

export const atoms = (
  context: ReadRuntimeContext,
  cache: MindmapReadCache
): MindmapReadAtoms => {
  const mindmapLayoutAtom = context.atom(READ_PUBLIC_KEYS.mindmapLayout)
  const readSnapshotAtom = context.atom(READ_SUBSCRIBE_KEYS.snapshot)
  const mindmapByIdAtoms = new Map<NodeId, Atom<MindmapViewTree | undefined>>()

  const mindmapIdsAtom = atom((get) => {
    get(readSnapshotAtom)
    get(mindmapLayoutAtom)
    return cache.getSnapshot().ids
  })

  const mindmapById = (id: NodeId) => {
    const cached = mindmapByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      get(readSnapshotAtom)
      get(mindmapLayoutAtom)
      return cache.getSnapshot().byId.get(id)
    })
    mindmapByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  return {
    mindmapIds: mindmapIdsAtom,
    mindmapById
  }
}
