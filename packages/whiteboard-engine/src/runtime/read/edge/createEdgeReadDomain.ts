import { atom, type createStore } from 'jotai/vanilla'
import type { EdgeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgePathEntry, EdgeEndpoints } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { Change } from '../../write/pipeline/ChangeBus'
import { createEdgeModel } from './createEdgeModel'
import { createEdgeView, type EdgeViewAtoms } from './createEdgeView'

type CreateEdgeReadDomainOptions = {
  store: ReturnType<typeof createStore>
  selectionAtom: StateAtoms['selection']
  readSnapshot: () => ReadModelSnapshot
  getNodeRect: QueryCanvas['nodeRect']
}

export type EdgeReadDomain = {
  atoms: EdgeViewAtoms
  applyChange: (change: Change) => void
  get: {
    edgeIds: () => EdgeId[]
    edgeById: (id: EdgeId) => EdgePathEntry | undefined
    selectedEdgeId: () => EdgeId | undefined
    edgeSelectedEndpoints: () => EdgeEndpoints | undefined
  }
}

const shouldBumpEdgeRevision = (change: Change) => {
  if (change.kind === 'replace') return true
  const { impact } = change
  if (
    impact.tags.has('full') ||
    impact.tags.has('edges') ||
    impact.tags.has('mindmap') ||
    impact.tags.has('geometry')
  ) {
    return true
  }
  return Boolean(impact.dirtyNodeIds?.length || impact.dirtyEdgeIds?.length)
}

export const createEdgeReadDomain = ({
  store,
  selectionAtom,
  readSnapshot,
  getNodeRect
}: CreateEdgeReadDomainOptions): EdgeReadDomain => {
  const edgeRevisionAtom = atom(0)

  const edgeModel = createEdgeModel({
    readSnapshot,
    getNodeRect
  })

  const atoms = createEdgeView({
    selectionAtom,
    edgeRevisionAtom,
    edgeModel
  })

  const applyChange: EdgeReadDomain['applyChange'] = (change) => {
    edgeModel.applyChange(change)
    if (!shouldBumpEdgeRevision(change)) return
    store.set(edgeRevisionAtom, (previous: number) => previous + 1)
  }

  return {
    atoms,
    applyChange,
    get: {
      edgeIds: () => store.get(atoms.edgeIds),
      edgeById: (id) => store.get(atoms.edgeById(id)),
      selectedEdgeId: () => store.get(atoms.selectedEdgeId),
      edgeSelectedEndpoints: () => store.get(atoms.edgeSelectedEndpoints)
    }
  }
}
