import { atom, type Atom } from 'jotai/vanilla'
import type { EdgeId } from '@whiteboard/core/types'
import type { EdgeEndpoints, EdgePathEntry } from '@engine-types/instance/read'
import type { StateAtoms } from '../../../state/factory/CreateState'
import type { EdgeReadModel } from './createEdgeModel'

type EdgeViewOptions = {
  selectionAtom: StateAtoms['selection']
  edgeRevisionAtom: Atom<number>
  edgeModel: Pick<EdgeReadModel, 'getIds' | 'getById' | 'getEndpoints'>
}

export type EdgeViewAtoms = {
  edgeIds: Atom<EdgeId[]>
  edgeById: (id: EdgeId) => Atom<EdgePathEntry | undefined>
  selectedEdgeId: Atom<EdgeId | undefined>
  edgeSelectedEndpoints: Atom<EdgeEndpoints | undefined>
}

export const createEdgeView = ({
  selectionAtom,
  edgeRevisionAtom,
  edgeModel
}: EdgeViewOptions): EdgeViewAtoms => {
  const edgeByIdAtoms = new Map<EdgeId, Atom<EdgePathEntry | undefined>>()
  let edgeSelectedEndpointsCache: EdgeEndpoints | undefined

  const edgeIdsAtom = atom((get) => {
    get(edgeRevisionAtom)
    return edgeModel.getIds()
  })

  const edgeById = (id: EdgeId) => {
    const cached = edgeByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      get(edgeRevisionAtom)
      return edgeModel.getById().get(id)
    })
    edgeByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  const selectedEdgeIdAtom = atom((get) => get(selectionAtom).selectedEdgeId)

  const edgeSelectedEndpointsAtom = atom((get) => {
    get(edgeRevisionAtom)
    const selectedEdgeId = get(selectedEdgeIdAtom)
    const next = selectedEdgeId
      ? edgeModel.getEndpoints(selectedEdgeId)
      : undefined

    const changed =
      edgeSelectedEndpointsCache?.source.point.x !== next?.source.point.x ||
      edgeSelectedEndpointsCache?.source.point.y !== next?.source.point.y ||
      edgeSelectedEndpointsCache?.target.point.x !== next?.target.point.x ||
      edgeSelectedEndpointsCache?.target.point.y !== next?.target.point.y ||
      edgeSelectedEndpointsCache?.source.nodeId !== next?.source.nodeId ||
      edgeSelectedEndpointsCache?.target.nodeId !== next?.target.nodeId

    if (changed) {
      edgeSelectedEndpointsCache = next
    }
    return edgeSelectedEndpointsCache
  })

  return {
    edgeIds: edgeIdsAtom,
    edgeById,
    selectedEdgeId: selectedEdgeIdAtom,
    edgeSelectedEndpoints: edgeSelectedEndpointsAtom
  }
}
