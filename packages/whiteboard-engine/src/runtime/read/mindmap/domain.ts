import type { Atom, createStore } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapView, MindmapViewTree } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { State } from '@engine-types/instance/state'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { Change } from '../../write/pipeline/ChangeBus'
import { derivations } from './derivations'
import {
  view,
  type MindmapViewAtoms
} from './view'

type MindmapOptions = {
  store: ReturnType<typeof createStore>
  readState: State['read']
  readSnapshot: () => ReadModelSnapshot
  readSnapshotAtom: Atom<ReadModelSnapshot>
  mindmapLayoutAtom: StateAtoms['mindmapLayout']
  config: InstanceConfig
}

export type MindmapReadDomain = {
  atoms: MindmapViewAtoms
  applyChange?: (change: Change) => void
  get: {
    mindmapIds: () => NodeId[]
    mindmapById: (id: NodeId) => MindmapViewTree | undefined
  }
}

type MindmapViewCache = {
  trees: MindmapViewTree[]
  view: MindmapView
}

const isSameMindmapTreeList = (
  left: readonly MindmapViewTree[],
  right: readonly MindmapViewTree[]
) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const domain = ({
  store,
  readState,
  readSnapshot,
  readSnapshotAtom,
  mindmapLayoutAtom,
  config
}: MindmapOptions): MindmapReadDomain => {
  const model = derivations({
    readState,
    readSnapshot,
    config
  })
  let mindmapViewCache: MindmapViewCache | undefined

  const getMindmapView = (): MindmapView => {
    const trees = model.trees()
    if (mindmapViewCache && isSameMindmapTreeList(mindmapViewCache.trees, trees)) {
      return mindmapViewCache.view
    }

    const view: MindmapView = {
      ids: trees.map((entry) => entry.id),
      byId: new Map(trees.map((entry) => [entry.id, entry]))
    }
    mindmapViewCache = {
      trees,
      view
    }
    return view
  }

  const atoms = view({
    mindmapLayoutAtom,
    readSnapshotAtom,
    getMindmapIds: () => getMindmapView().ids,
    getMindmapById: (id) => getMindmapView().byId.get(id)
  })

  return {
    atoms,
    get: {
      mindmapIds: () => store.get(atoms.mindmapIds),
      mindmapById: (id) => store.get(atoms.mindmapById(id))
    }
  }
}
