import { toEdgePathSignature, toNodeGeometrySignature } from '@whiteboard/core/cache'
import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgeEndpoints, EdgePathEntry } from '@engine-types/instance/read'

type EdgeModelCacheEntry = {
  geometrySignature: string
  endpoints: EdgeEndpoints
  entry: EdgePathEntry
}

type EdgeNodeRectGetter = QueryCanvas['nodeRect']

type EdgeModelOptions = {
  getNodeRect: EdgeNodeRectGetter
}

export type EdgeReadSnapshot = {
  readonly ids: EdgeId[]
  readonly byId: Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

export type EdgeReadModel = {
  rebuildAll: (edges: Edge[]) => void
  updateByDirtyNodeIds: (dirtyNodeIds: Iterable<NodeId>) => void
  getSnapshot: () => EdgeReadSnapshot
}

type EdgeModelRelations = {
  edgeById: Map<EdgeId, Edge>
  edgeOrderIds: EdgeId[]
  nodeToEdgeIds: Map<NodeId, Set<EdgeId>>
}

type EdgeModelState = {
  relations: EdgeModelRelations
  cacheById: Map<EdgeId, EdgeModelCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgePathEntry>
}

const emptyRelations = (): EdgeModelRelations => ({
  edgeById: new Map<EdgeId, Edge>(),
  edgeOrderIds: [],
  nodeToEdgeIds: new Map<NodeId, Set<EdgeId>>()
})

const emptyState = (): EdgeModelState => ({
  relations: emptyRelations(),
  cacheById: new Map<EdgeId, EdgeModelCacheEntry>(),
  ids: [],
  byId: new Map<EdgeId, EdgePathEntry>()
})

const isSameView = (
  prevIds: readonly EdgeId[],
  prevById: ReadonlyMap<EdgeId, EdgePathEntry>,
  nextIds: readonly EdgeId[],
  nextById: ReadonlyMap<EdgeId, EdgePathEntry>
) => {
  if (prevIds.length !== nextIds.length) return false
  for (let index = 0; index < prevIds.length; index += 1) {
    const edgeId = prevIds[index]
    if (edgeId !== nextIds[index]) return false
    if (prevById.get(edgeId) !== nextById.get(edgeId)) return false
  }
  return true
}

const rebuildView = (state: EdgeModelState) => {
  const nextIds: EdgeId[] = []
  const nextById = new Map<EdgeId, EdgePathEntry>()

  state.relations.edgeOrderIds.forEach((edgeId) => {
    const entry = state.cacheById.get(edgeId)?.entry
    if (!entry) return
    nextIds.push(edgeId)
    nextById.set(edgeId, entry)
  })

  if (isSameView(state.ids, state.byId, nextIds, nextById)) return

  state.ids = nextIds
  state.byId = nextById
}

const replaceRelations = (state: EdgeModelState, edges: Edge[]) => {
  const next = createEdgeRelations(edges)
  state.relations = {
    edgeById: next.edgeById,
    edgeOrderIds: next.edgeIds,
    nodeToEdgeIds: next.nodeToEdgeIds
  }
}

// Invariants:
// 1) `ids/byId` are derived only from `relations.edgeOrderIds + cacheById`.
// 2) `snapshot` object reference is stable and reads latest state via getters.
// 3) cache reuse requires the same geometrySignature; edge ref change only swaps entry.edge.
export const model = ({ getNodeRect }: EdgeModelOptions): EdgeReadModel => {
  const state = emptyState()
  const snapshot: EdgeReadSnapshot = {
    get ids() {
      return state.ids
    },
    get byId() {
      return state.byId
    },
    getEndpoints: (edgeId) => state.cacheById.get(edgeId)?.endpoints
  }

  const getNodeGeometrySignature = (
    nodeId: EdgePathEntry['edge']['source']['nodeId']
  ) => toNodeGeometrySignature(getNodeRect(nodeId))

  const getEdgeGeometrySignature = (edge: EdgePathEntry['edge']) =>
    toEdgePathSignature(edge, getNodeGeometrySignature)

  const reuseCacheEntry = (
    edge: EdgePathEntry['edge'],
    geometrySignature: string,
    previous?: EdgeModelCacheEntry
  ): EdgeModelCacheEntry | undefined => {
    if (!previous || previous.geometrySignature !== geometrySignature) {
      return undefined
    }
    if (previous.entry.edge === edge) {
      return previous
    }
    return {
      geometrySignature,
      endpoints: previous.endpoints,
      entry: {
        ...previous.entry,
        edge
      }
    }
  }

  const buildCacheEntry = (
    edge: EdgePathEntry['edge'],
    geometrySignature: string
  ): EdgeModelCacheEntry | undefined => {
    const sourceEntry = getNodeRect(edge.source.nodeId)
    const targetEntry = getNodeRect(edge.target.nodeId)
    if (!sourceEntry || !targetEntry) return undefined

    const { path, endpoints } = resolveEdgePathFromRects({
      edge,
      source: {
        rect: sourceEntry.rect,
        rotation: sourceEntry.rotation
      },
      target: {
        rect: targetEntry.rect,
        rotation: targetEntry.rotation
      }
    })

    return {
      geometrySignature,
      endpoints,
      entry: {
        id: edge.id,
        edge,
        path
      }
    }
  }

  const toCacheEntry = (
    edge: EdgePathEntry['edge'],
    previous?: EdgeModelCacheEntry
  ): EdgeModelCacheEntry | undefined => {
    const geometrySignature = getEdgeGeometrySignature(edge)
    return (
      reuseCacheEntry(edge, geometrySignature, previous) ??
      buildCacheEntry(edge, geometrySignature)
    )
  }

  const commitEntriesAndView = (
    nextCacheById: Map<EdgeId, EdgeModelCacheEntry>
  ) => {
    if (state.cacheById === nextCacheById) return
    state.cacheById = nextCacheById
    rebuildView(state)
  }

  const rebuildEntries = (edges: Edge[]) => {
    const previousCacheById = state.cacheById
    const nextCacheById = new Map<EdgeId, EdgeModelCacheEntry>()

    edges.forEach((edge) => {
      const nextEntry = toCacheEntry(edge, previousCacheById.get(edge.id))
      if (!nextEntry) return
      nextCacheById.set(edge.id, nextEntry)
    })

    commitEntriesAndView(nextCacheById)
  }

  const patchEntriesByEdgeIds = (edgeIds: Iterable<EdgeId>) => {
    let draftCacheById = state.cacheById
    const ensureDraftCache = () => {
      if (draftCacheById === state.cacheById) {
        draftCacheById = new Map(state.cacheById)
      }
      return draftCacheById
    }

    for (const edgeId of edgeIds) {
      const edge = state.relations.edgeById.get(edgeId)
      const previous = state.cacheById.get(edgeId)
      const next = edge ? toCacheEntry(edge, previous) : undefined
      if (previous === next) continue
      const draft = ensureDraftCache()
      if (next) {
        draft.set(edgeId, next)
      } else {
        draft.delete(edgeId)
      }
    }

    if (draftCacheById !== state.cacheById) {
      commitEntriesAndView(draftCacheById)
    }
  }

  const rebuildAll: EdgeReadModel['rebuildAll'] = (edges) => {
    replaceRelations(state, edges)
    rebuildEntries(edges)
  }

  const updateByDirtyNodeIds: EdgeReadModel['updateByDirtyNodeIds'] = (
    dirtyNodeIds
  ) => {
    const dirtyNodeIdSet = new Set(dirtyNodeIds)
    if (!dirtyNodeIdSet.size) return
    const affectedEdgeIds = collectRelatedEdgeIds(
      state.relations.nodeToEdgeIds,
      dirtyNodeIdSet
    )
    if (!affectedEdgeIds.size) return

    patchEntriesByEdgeIds(affectedEdgeIds)
  }

  const getSnapshot: EdgeReadModel['getSnapshot'] = () => snapshot

  return {
    rebuildAll,
    updateByDirtyNodeIds,
    getSnapshot
  }
}
