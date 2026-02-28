import { atom, type Atom } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import type { MindmapViewTree } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { MindmapReadModel } from './createMindmapModel'

type MindmapViewOptions = {
  mindmapLayoutAtom: StateAtoms['mindmapLayout']
  readSnapshotAtom: Atom<ReadModelSnapshot>
  mindmapModel: Pick<MindmapReadModel, 'getMindmapIds' | 'getMindmapById'>
}

export type MindmapViewAtoms = {
  mindmapIds: Atom<NodeId[]>
  mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
}

export const createMindmapView = ({
  mindmapLayoutAtom,
  readSnapshotAtom,
  mindmapModel
}: MindmapViewOptions): MindmapViewAtoms => {
  const mindmapByIdAtoms = new Map<NodeId, Atom<MindmapViewTree | undefined>>()

  const mindmapIdsAtom = atom((get) => {
    get(readSnapshotAtom)
    get(mindmapLayoutAtom)
    return mindmapModel.getMindmapIds()
  })

  const mindmapById = (id: NodeId) => {
    const cached = mindmapByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      get(readSnapshotAtom)
      get(mindmapLayoutAtom)
      return mindmapModel.getMindmapById(id)
    })
    mindmapByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  return {
    mindmapIds: mindmapIdsAtom,
    mindmapById
  }
}
