import { atom, type Atom } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { StateAtoms } from '../../../state/factory/CreateState'

type MindmapViewOptions = {
  mindmapLayoutAtom: StateAtoms['mindmapLayout']
  readSnapshotAtom: Atom<ReadModelSnapshot>
  getMindmapIds: () => NodeId[]
  getMindmapById: (id: NodeId) => MindmapViewTree | undefined
}

export type MindmapViewAtoms = {
  mindmapIds: Atom<NodeId[]>
  mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
}

export const view = ({
  mindmapLayoutAtom,
  readSnapshotAtom,
  getMindmapIds,
  getMindmapById
}: MindmapViewOptions): MindmapViewAtoms => {
  const mindmapByIdAtoms = new Map<NodeId, Atom<MindmapViewTree | undefined>>()

  const mindmapIdsAtom = atom((get) => {
    get(readSnapshotAtom)
    get(mindmapLayoutAtom)
    return getMindmapIds()
  })

  const mindmapById = (id: NodeId) => {
    const cached = mindmapByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      get(readSnapshotAtom)
      get(mindmapLayoutAtom)
      return getMindmapById(id)
    })
    mindmapByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  return {
    mindmapIds: mindmapIdsAtom,
    mindmapById
  }
}
