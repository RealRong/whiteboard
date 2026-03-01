import { toEdgePathSignature, toNodeGeometrySignature } from '@whiteboard/core/cache'
import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects,
  type EdgeRelations
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

type EdgeCacheState = {
  relations: EdgeRelations
  cacheById: Map<EdgeId, EdgeCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgePathEntry>
}

const emptyRelations = (): EdgeRelations => ({
  edgeById: new Map<EdgeId, Edge>(),
  edgeIds: [],
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

  state.relations.edgeIds.forEach((edgeId) => {
    const entry = state.cacheById.get(edgeId)?.entry
    if (!entry) return
    nextIds.push(edgeId)
    nextById.set(edgeId, entry)
  })

  if (isSameView(state.ids, state.byId, nextIds, nextById)) return

  state.ids = nextIds
  state.byId = nextById
}

// Invariants:
// 1) `ids/byId` are derived only from `relations.edgeIds + cacheById`.
// 2) `snapshot` object reference is stable and reads latest state via getters.
// 3) cache reuse requires the same geometrySignature; edge ref change only swaps entry.edge.
export const cache = (context: ReadRuntimeContext): EdgeReadCache => {
  const getNodeRect = context.query.canvas.nodeRect
  const readModelSnapshot = () => context.get(READ_SUBSCRIBE_KEYS.snapshot)
  const state = emptyState()
  let visibleEdgesRef: ReturnType<typeof readModelSnapshot>['edges']['visible'] | undefined
  let pendingResetVisibleEdges = false
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

  const reuseCacheEntry = (
    edge: EdgePathEntry['edge'],
    geometrySignature: string,
    previous?: EdgeCacheEntry
  ): EdgeCacheEntry | undefined =>
    previous?.geometrySignature === geometrySignature
      ? previous.entry.edge === edge
        ? previous
        : {
          geometrySignature,
          endpoints: previous.endpoints,
          entry: {
            ...previous.entry,
            edge
          }
        }
      : undefined

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
    const geometrySignature = toEdgePathSignature(edge, getNodeGeometrySignature)
    return (
      reuseCacheEntry(edge, geometrySignature, previous) ??
      buildCacheEntry(edge, geometrySignature)
    )
  }

  const commitEntriesAndView = (nextCacheById: Map<EdgeId, EdgeCacheEntry>) => {
    if (state.cacheById === nextCacheById) return
    state.cacheById = nextCacheById
    rebuildView(state)
  }

  const reconcileAll = (edges: Edge[]) => {
    const previousCacheById = state.cacheById
    state.relations = createEdgeRelations(edges)

    const nextCacheById = new Map<EdgeId, EdgeCacheEntry>()
    state.relations.edgeIds.forEach((edgeId) => {
      const edge = state.relations.edgeById.get(edgeId)
      if (!edge) return
      const nextEntry = toCacheEntry(edge, previousCacheById.get(edgeId))
      if (!nextEntry) return
      nextCacheById.set(edgeId, nextEntry)
    })

    commitEntriesAndView(nextCacheById)
  }

  const reconcileEdges = (edgeIds: ReadonlySet<EdgeId>) => {
    let draftCacheById: Map<EdgeId, EdgeCacheEntry> | undefined

    for (const edgeId of edgeIds) {
      const edge = state.relations.edgeById.get(edgeId)
      const previous = state.cacheById.get(edgeId)
      const next = edge ? toCacheEntry(edge, previous) : undefined
      if (previous === next) continue

      if (!draftCacheById) {
        draftCacheById = new Map(state.cacheById)
      }

      if (next) {
        draftCacheById.set(edgeId, next)
      } else {
        draftCacheById.delete(edgeId)
      }
    }

    if (draftCacheById) {
      commitEntriesAndView(draftCacheById)
    }
  }

  const ensureEntries = () => {
    if (pendingResetVisibleEdges) {
      visibleEdgesRef = undefined
      pendingResetVisibleEdges = false
    }

    const visibleEdges = readModelSnapshot().edges.visible
    if (visibleEdges !== visibleEdgesRef) {
      visibleEdgesRef = visibleEdges
      pendingDirtyNodeIds = new Set<NodeId>()
      reconcileAll(visibleEdges)
      return
    }

    if (!pendingDirtyNodeIds.size) return

    const dirtyNodeIds = pendingDirtyNodeIds
    pendingDirtyNodeIds = new Set<NodeId>()

    const affectedEdgeIds = collectRelatedEdgeIds(
      state.relations.nodeToEdgeIds,
      dirtyNodeIds
    )
    if (!affectedEdgeIds.size) return

    reconcileEdges(affectedEdgeIds)
  }

  const applyPlan: EdgeReadCache['applyPlan'] = (plan) => {
    // `clearPendingDirtyNodeIds` only appears on full-sync plans.
    // In that case we force next ensureEntries() into full reconcile by clearing
    // all pending signals and invalidating visibleEdgesRef.
    if (plan.clearPendingDirtyNodeIds) {
      visibleEdgesRef = undefined
      pendingResetVisibleEdges = false
      pendingDirtyNodeIds = new Set<NodeId>()
      return
    }

    if (plan.resetVisibleEdges) {
      pendingResetVisibleEdges = true
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
