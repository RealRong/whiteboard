import type {
  EdgePathEntry,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { EdgeId } from '@whiteboard/core'
import {
  isSameIdOrder,
  notifyListeners,
  watchEntity,
  watchSet
} from './shared'

type EdgePathViewEntry = ViewSnapshot['edge.paths'][number]

type Options = {
  readPaths: () => ViewSnapshot['edge.paths']
}

export type EdgeRegistry = {
  sync: () => void
  getEdgeIds: () => EdgeId[]
  watchEdgeIds: (listener: () => void) => () => void
  getEdgePath: (edgeId: EdgeId) => EdgePathEntry | undefined
  watchEdgePath: (edgeId: EdgeId, listener: () => void) => () => void
}

export const createEdgeRegistry = ({
  readPaths
}: Options): EdgeRegistry => {
  const edgeIdsListeners = new Set<() => void>()
  const edgePathListeners = new Map<EdgeId, Set<() => void>>()

  let edgeIds: EdgeId[] = []
  let edgePathsById = new Map<EdgeId, EdgePathViewEntry>()

  const hasSubscribers = () =>
    edgeIdsListeners.size > 0 || edgePathListeners.size > 0

  const pull = () => {
    const paths = readPaths()
    edgeIds = paths.map((entry) => entry.id)
    edgePathsById = new Map<EdgeId, EdgePathViewEntry>(
      paths.map((entry) => [entry.id, entry])
    )
  }

  const sync: EdgeRegistry['sync'] = () => {
    if (!hasSubscribers()) return
    const paths = readPaths()
    const nextIds = paths.map((entry) => entry.id)
    const nextById = new Map<EdgeId, EdgePathViewEntry>()
    paths.forEach((entry) => {
      nextById.set(entry.id, entry)
    })

    const changedIds = new Set<EdgeId>()
    nextById.forEach((entry, edgeId) => {
      if (edgePathsById.get(edgeId) !== entry) {
        changedIds.add(edgeId)
      }
    })
    edgePathsById.forEach((_, edgeId) => {
      if (!nextById.has(edgeId)) {
        changedIds.add(edgeId)
      }
    })

    const edgeOrderChanged = !isSameIdOrder(edgeIds, nextIds)
    if (edgeOrderChanged) {
      edgeIds = nextIds
      notifyListeners(edgeIdsListeners)
    }
    edgePathsById = nextById

    changedIds.forEach((edgeId) => {
      notifyListeners(edgePathListeners.get(edgeId))
    })
  }

  return {
    sync,
    getEdgeIds: () => {
      if (!hasSubscribers()) {
        pull()
      }
      return edgeIds
    },
    watchEdgeIds: (listener) => {
      pull()
      return watchSet(edgeIdsListeners, listener)
    },
    getEdgePath: (edgeId) => {
      if (!hasSubscribers()) {
        pull()
      }
      return edgePathsById.get(edgeId) as EdgePathEntry | undefined
    },
    watchEdgePath: (edgeId, listener) => {
      pull()
      return watchEntity(edgePathListeners, edgeId, listener)
    }
  }
}
