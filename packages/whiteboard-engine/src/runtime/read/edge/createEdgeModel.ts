import { toEdgePathSignature, toNodeGeometrySignature } from '@whiteboard/core/cache'
import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import type { QueryCanvas } from '@engine-types/instance/query'
import type { EdgeEndpoints, EdgePathEntry } from '@engine-types/instance/read'
import type { ReadModelSnapshot } from '@engine-types/readSnapshot'
import { hasImpactTag } from '../../write/mutation/Impact'
import type { Change } from '../../write/pipeline/ChangeBus'

type EdgeModelCacheEntry = {
  geometrySignature: string
  endpoints: EdgeEndpoints
  entry: EdgePathEntry
}

type EdgeModelOptions = {
  readSnapshot: () => ReadModelSnapshot
  getNodeRect: QueryCanvas['nodeRect']
}

export type EdgeReadModel = {
  applyChange: (change: Change) => void
  getIds: () => EdgeId[]
  getById: () => Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

type EdgeModelState = {
  edgesRef: Edge[] | undefined
  pendingDirtyNodeIds: Set<NodeId>
  edgeById: Map<EdgeId, Edge>
  edgeOrderIds: EdgeId[]
  nodeToEdgeIds: Map<NodeId, Set<EdgeId>>
  cacheById: Map<EdgeId, EdgeModelCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgePathEntry>
}

const createEmptyState = (): EdgeModelState => ({
  edgesRef: undefined,
  pendingDirtyNodeIds: new Set<NodeId>(),
  edgeById: new Map<EdgeId, Edge>(),
  edgeOrderIds: [],
  nodeToEdgeIds: new Map<NodeId, Set<EdgeId>>(),
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

const syncView = (
  state: EdgeModelState,
  cacheById: Map<EdgeId, EdgeModelCacheEntry>
) => {
  const nextIds: EdgeId[] = []
  const nextById = new Map<EdgeId, EdgePathEntry>()

  state.edgeOrderIds.forEach((edgeId) => {
    const entry = cacheById.get(edgeId)?.entry
    if (!entry) return
    nextIds.push(edgeId)
    nextById.set(edgeId, entry)
  })

  if (isSameView(state.ids, state.byId, nextIds, nextById)) return

  state.ids = nextIds
  state.byId = nextById
}

const syncRelations = (state: EdgeModelState, edges: Edge[]) => {
  const relations = createEdgeRelations(edges)
  state.edgeById = relations.edgeById
  state.edgeOrderIds = relations.edgeIds
  state.nodeToEdgeIds = relations.nodeToEdgeIds
}

export const createEdgeModel = ({
  readSnapshot,
  getNodeRect
}: EdgeModelOptions): EdgeReadModel => {
  const state = createEmptyState()

  const getNodeGeometrySignature = (
    nodeId: EdgePathEntry['edge']['source']['nodeId']
  ) => toNodeGeometrySignature(getNodeRect(nodeId))

  const getEdgeGeometrySignature = (edge: EdgePathEntry['edge']) =>
    toEdgePathSignature(edge, getNodeGeometrySignature)

  const toCacheEntry = (
    edge: EdgePathEntry['edge'],
    previous?: EdgeModelCacheEntry
  ): EdgeModelCacheEntry | undefined => {
    const geometrySignature = getEdgeGeometrySignature(edge)
    if (previous?.geometrySignature === geometrySignature) {
      if (previous.entry.edge === edge) return previous
      return {
        geometrySignature,
        endpoints: previous.endpoints,
        entry: {
          ...previous.entry,
          edge
        }
      }
    }

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

  const rebuildCache = (edges: Edge[]) => {
    const previousCacheById = state.cacheById
    const nextCacheById = new Map<EdgeId, EdgeModelCacheEntry>()

    edges.forEach((edge) => {
      const nextEntry = toCacheEntry(edge, previousCacheById.get(edge.id))
      if (!nextEntry) return
      nextCacheById.set(edge.id, nextEntry)
    })

    state.cacheById = nextCacheById
    syncView(state, nextCacheById)
  }

  const updateCacheByEdgeIds = (edgeIds: Iterable<EdgeId>) => {
    let nextCacheById = state.cacheById
    let changed = false

    for (const edgeId of edgeIds) {
      const edge = state.edgeById.get(edgeId)
      const previous = state.cacheById.get(edgeId)

      if (!edge) {
        if (!previous) continue
        if (!changed) {
          nextCacheById = new Map(state.cacheById)
          changed = true
        }
        nextCacheById.delete(edgeId)
        continue
      }

      const next = toCacheEntry(edge, previous)

      if (!next) {
        if (!previous) continue
        if (!changed) {
          nextCacheById = new Map(state.cacheById)
          changed = true
        }
        nextCacheById.delete(edgeId)
        continue
      }

      if (previous === next) continue
      if (!changed) {
        nextCacheById = new Map(state.cacheById)
        changed = true
      }
      nextCacheById.set(edgeId, next)
    }

    if (!changed) return

    state.cacheById = nextCacheById
    syncView(state, nextCacheById)
  }

  const rebuildAll = (edges: Edge[]) => {
    syncRelations(state, edges)
    rebuildCache(edges)
  }

  const ensureEntries = () => {
    const edges = readSnapshot().edges.visible
    if (edges !== state.edgesRef) {
      state.edgesRef = edges
      state.pendingDirtyNodeIds = new Set<NodeId>()
      rebuildAll(edges)
      return
    }

    if (!state.pendingDirtyNodeIds.size) return
    const dirtyNodeIds = state.pendingDirtyNodeIds
    state.pendingDirtyNodeIds = new Set<NodeId>()

    const affectedEdgeIds = collectRelatedEdgeIds(
      state.nodeToEdgeIds,
      dirtyNodeIds
    )
    if (!affectedEdgeIds.size) return

    updateCacheByEdgeIds(affectedEdgeIds)
  }

  const applyChange: EdgeReadModel['applyChange'] = (change) => {
    const impact = change.impact
    const fullSync = change.kind === 'replace' || hasImpactTag(impact, 'full')
    const dirtyNodeIds = impact.dirtyNodeIds
    const shouldReset =
      fullSync ||
      hasImpactTag(impact, 'edges') ||
      hasImpactTag(impact, 'mindmap') ||
      (hasImpactTag(impact, 'geometry') && !dirtyNodeIds?.length)

    if (fullSync) {
      state.edgesRef = undefined
      state.pendingDirtyNodeIds = new Set<NodeId>()
      return
    }
    if (shouldReset) {
      state.edgesRef = undefined
    }
    if (!dirtyNodeIds?.length) return
    dirtyNodeIds.forEach((nodeId) => {
      state.pendingDirtyNodeIds.add(nodeId)
    })
  }

  const getIds: EdgeReadModel['getIds'] = () => {
    ensureEntries()
    return state.ids
  }

  const getById: EdgeReadModel['getById'] = () => {
    ensureEntries()
    return state.byId
  }

  const getEndpoints: EdgeReadModel['getEndpoints'] = (edgeId) => {
    ensureEntries()
    return state.cacheById.get(edgeId)?.endpoints
  }

  return {
    applyChange,
    getIds,
    getById,
    getEndpoints
  }
}
