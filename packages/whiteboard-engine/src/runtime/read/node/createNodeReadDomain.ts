import type { createStore } from 'jotai/vanilla'
import type { NodeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { NodeViewItem, ViewportTransformView } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { Atom } from 'jotai/vanilla'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { Change } from '../../write/pipeline/ChangeBus'
import { createNodeModel } from './createNodeModel'
import { createNodeView, type NodeViewAtoms } from './createNodeView'

type CreateNodeReadDomainOptions = {
  store: ReturnType<typeof createStore>
  viewportAtom: StateAtoms['viewport']
  readSnapshotAtom: Atom<ReadModelSnapshot>
  readSnapshot: () => ReadModelSnapshot
  getNodeRect: QueryCanvas['nodeRect']
}

export type NodeReadDomain = {
  atoms: NodeViewAtoms
  applyChange: (change: Change) => void
  get: {
    viewportTransform: () => ViewportTransformView
    nodeIds: () => NodeId[]
    nodeById: (id: NodeId) => NodeViewItem | undefined
  }
}

export const createNodeReadDomain = ({
  store,
  viewportAtom,
  readSnapshotAtom,
  readSnapshot,
  getNodeRect
}: CreateNodeReadDomainOptions): NodeReadDomain => {
  const nodeModel = createNodeModel({
    readSnapshot
  })

  const atoms = createNodeView({
    viewportAtom,
    readSnapshotAtom,
    getNodeRect,
    nodeModel
  })

  return {
    atoms,
    applyChange: (change) => {
      nodeModel.applyChange(change)
    },
    get: {
      viewportTransform: () => store.get(atoms.viewportTransform),
      nodeIds: () => store.get(atoms.nodeIds),
      nodeById: (id) => store.get(atoms.nodeById(id))
    }
  }
}
