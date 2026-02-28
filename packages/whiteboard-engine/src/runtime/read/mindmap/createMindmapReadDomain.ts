import type { Atom, createStore } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapViewTree } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { State } from '@engine-types/instance/state'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { Change } from '../../write/pipeline/ChangeBus'
import { createMindmapModel } from './createMindmapModel'
import {
  createMindmapView,
  type MindmapViewAtoms
} from './createMindmapView'

type CreateMindmapReadDomainOptions = {
  store: ReturnType<typeof createStore>
  readState: State['read']
  readSnapshot: () => ReadModelSnapshot
  readSnapshotAtom: Atom<ReadModelSnapshot>
  mindmapLayoutAtom: StateAtoms['mindmapLayout']
  config: InstanceConfig
}

export type MindmapReadDomain = {
  atoms: MindmapViewAtoms
  applyChange: (change: Change) => void
  get: {
    mindmapIds: () => NodeId[]
    mindmapById: (id: NodeId) => MindmapViewTree | undefined
  }
}

export const createMindmapReadDomain = ({
  store,
  readState,
  readSnapshot,
  readSnapshotAtom,
  mindmapLayoutAtom,
  config
}: CreateMindmapReadDomainOptions): MindmapReadDomain => {
  const mindmapModel = createMindmapModel({
    readState,
    readSnapshot,
    config
  })

  const atoms = createMindmapView({
    mindmapLayoutAtom,
    readSnapshotAtom,
    mindmapModel
  })

  return {
    atoms,
    applyChange: (change) => {
      mindmapModel.applyChange(change)
    },
    get: {
      mindmapIds: () => store.get(atoms.mindmapIds),
      mindmapById: (id) => store.get(atoms.mindmapById(id))
    }
  }
}
