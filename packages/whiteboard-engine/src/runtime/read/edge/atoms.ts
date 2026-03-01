import { atom, type Atom } from 'jotai/vanilla'
import type { EdgeId } from '@whiteboard/core/types'
import {
  READ_PUBLIC_KEYS,
  type EdgeEndpoints,
  type EdgePathEntry
} from '@engine-types/instance/read'
import {
  READ_INTERNAL_SIGNAL_KEYS,
  type ReadRuntimeContext
} from '../context'
import type { EdgeReadCache } from './cache'

export type EdgeReadAtoms = {
  edgeIds: Atom<EdgeId[]>
  edgeById: (id: EdgeId) => Atom<EdgePathEntry | undefined>
  selectedEdgeId: Atom<EdgeId | undefined>
  edgeSelectedEndpoints: Atom<EdgeEndpoints | undefined>
}

export const atoms = (
  context: ReadRuntimeContext,
  cache: EdgeReadCache
): EdgeReadAtoms => {
  const selectionAtom = context.atom(READ_PUBLIC_KEYS.selection)
  const edgeRevisionAtom = context.atom(READ_INTERNAL_SIGNAL_KEYS.edgeRevision)
  const edgeByIdAtoms = new Map<EdgeId, Atom<EdgePathEntry | undefined>>()
  let edgeSelectedEndpointsCache: EdgeEndpoints | undefined

  const edgeIdsAtom = atom((get) => {
    get(edgeRevisionAtom)
    return cache.getSnapshot().ids
  })

  const edgeById = (id: EdgeId) => {
    const cached = edgeByIdAtoms.get(id)
    if (cached) return cached

    const nextAtom = atom((get) => {
      get(edgeRevisionAtom)
      return cache.getSnapshot().byId.get(id)
    })
    edgeByIdAtoms.set(id, nextAtom)
    return nextAtom
  }

  const selectedEdgeIdAtom = atom((get) => get(selectionAtom).selectedEdgeId)

  const edgeSelectedEndpointsAtom = atom((get) => {
    get(edgeRevisionAtom)
    const selectedEdgeId = get(selectedEdgeIdAtom)
    const snapshot = cache.getSnapshot()
    const next = selectedEdgeId
      ? snapshot.getEndpoints(selectedEdgeId)
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
