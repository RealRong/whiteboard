import { toEdgePathSignature, toNodeGeometrySignature } from '@whiteboard/core/cache'
import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects
} from '@whiteboard/core/edge'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import {
  READ_SUBSCRIBE_KEYS,
  type EdgeEndpoints,
  type EdgePathEntry
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '../context'
import type { EdgeChangePlan } from '../changePlan'

type EdgeCacheEntry = {
  geometrySignature: string
  endpoints: EdgeEndpoints
  entry: EdgePathEntry
}

export type EdgeReadSnapshot = {
  readonly ids: EdgeId[]
  readonly byId: Map<EdgeId, EdgePathEntry>
  getEndpoints: (edgeId: EdgeId) => EdgeEndpoints | undefined
}

export type EdgeReadCache = {
  applyPlan: (plan: EdgeChangePlan) => void
  getSnapshot: () => EdgeReadSnapshot
}

type EdgeCacheRelations = {
  edgeById: Map<EdgeId, Edge>
  edgeOrderIds: EdgeId[]
  nodeToEdgeIds: Map<NodeId, Set<EdgeId>>
}

type EdgeCacheState = {
  relations: EdgeCacheRelations
  cacheById: Map<EdgeId, EdgeCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgePathEntry>
}

const emptyRelations = (): EdgeCacheRelations => ({
  edgeById: new Map<EdgeId, Edge>(),
  edgeOrderIds: [],
  nodeToEdgeIds: new Map<NodeId, Set<EdgeId>>()
})

const emptyState = (): EdgeCacheState => ({
  relations: emptyRelations(),
  cacheById: new Map<EdgeId, EdgeCacheEntry>(),
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

const rebuildView = (state: EdgeCacheState) => {
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

const replaceRelations = (state: EdgeCacheState, edges: Edge[]) => {
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
export const cache = (context: ReadRuntimeContext): EdgeReadCache => {
  const getNodeRect = context.query.canvas.nodeRect
  const readSnapshot = () => context.get(READ_SUBSCRIBE_KEYS.snapshot)
  const state = emptyState()
  let visibleEdgesRef: ReturnType<typeof readSnapshot>['edges']['visible'] | undefined
  let pendingDirtyNodeIds = new Set<NodeId>()
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
    previous?: EdgeCacheEntry
  ): EdgeCacheEntry | undefined => {
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
  ): EdgeCacheEntry | undefined => {
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
    previous?: EdgeCacheEntry
  ): EdgeCacheEntry | undefined => {
    const geometrySignature = getEdgeGeometrySignature(edge)
    return (
      reuseCacheEntry(edge, geometrySignature, previous) ??
      buildCacheEntry(edge, geometrySignature)
    )
  }

  const commitEntriesAndView = (
    nextCacheById: Map<EdgeId, EdgeCacheEntry>
  ) => {
    if (state.cacheById === nextCacheById) return
    state.cacheById = nextCacheById
    rebuildView(state)
  }

  const rebuildEntries = (edges: Edge[]) => {
    const previousCacheById = state.cacheById
    const nextCacheById = new Map<EdgeId, EdgeCacheEntry>()

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

  const rebuildAll = (edges: Edge[]) => {
    replaceRelations(state, edges)
    rebuildEntries(edges)
  }

  const updateByDirtyNodeIds = (dirtyNodeIds: Iterable<NodeId>) => {
    const dirtyNodeIdSet = new Set(dirtyNodeIds)
    if (!dirtyNodeIdSet.size) return
    const affectedEdgeIds = collectRelatedEdgeIds(
      state.relations.nodeToEdgeIds,
      dirtyNodeIdSet
    )
    if (!affectedEdgeIds.size) return

    patchEntriesByEdgeIds(affectedEdgeIds)
  }

  const ensureEntries = () => {
    const edges = readSnapshot().edges.visible
    if (edges !== visibleEdgesRef) {
      visibleEdgesRef = edges
      pendingDirtyNodeIds = new Set<NodeId>()
      rebuildAll(edges)
      return
    }

    if (!pendingDirtyNodeIds.size) return
    const dirtyNodeIds = pendingDirtyNodeIds
    pendingDirtyNodeIds = new Set<NodeId>()
    updateByDirtyNodeIds(dirtyNodeIds)
  }

  const applyPlan: EdgeReadCache['applyPlan'] = (plan) => {
    if (plan.clearPendingDirtyNodeIds) {
      visibleEdgesRef = undefined
      pendingDirtyNodeIds = new Set<NodeId>()
      return
    }

    if (plan.resetVisibleEdges) {
      visibleEdgesRef = undefined
    }
    if (plan.appendDirtyNodeIds.length) {
      plan.appendDirtyNodeIds.forEach((nodeId) => {
        pendingDirtyNodeIds.add(nodeId)
      })
    }
  }

  const getSnapshot: EdgeReadCache['getSnapshot'] = () => {
    ensureEntries()
    return snapshot
  }

  return {
    applyPlan,
    getSnapshot
  }
}
