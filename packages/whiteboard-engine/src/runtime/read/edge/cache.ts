import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects,
  type EdgeRelations
} from '@whiteboard/core/edge'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import {
  READ_SUBSCRIBE_KEYS,
  type CanvasNodeRect,
  type EdgeEndpoints,
  type EdgePathEntry
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '../context'
import type { EdgeChangePlan } from '../changePlan'

type EdgeCacheEntry = {
  sourceRectRef: CanvasNodeRect
  targetRectRef: CanvasNodeRect
  sourceGeometry: NodeGeometryTuple
  targetGeometry: NodeGeometryTuple
  structure: EdgeStructureTuple
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

type ReconcileMemo = {
  nodeRectById: Map<NodeId, ReturnType<ReadRuntimeContext['query']['canvas']['nodeRect']>>
}

type NodeGeometryTuple = {
  x: number
  y: number
  width: number
  height: number
  rotation: number
}

type EdgeStructureTuple = {
  type: string
  sourceNodeId: NodeId
  targetNodeId: NodeId
  sourceAnchorSide?: string
  sourceAnchorOffset?: number
  targetAnchorSide?: string
  targetAnchorOffset?: number
  routingMode?: string
  routingOrthoOffset?: number
  routingOrthoRadius?: number
  routingPointsRef?: readonly { x: number; y: number }[]
}

type EdgeCacheMaterial = {
  sourceRectRef: CanvasNodeRect
  targetRectRef: CanvasNodeRect
  sourceGeometry: NodeGeometryTuple
  targetGeometry: NodeGeometryTuple
  structure: EdgeStructureTuple
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

const toNodeGeometryTuple = (entry: CanvasNodeRect): NodeGeometryTuple => ({
  x: entry.rect.x,
  y: entry.rect.y,
  width: entry.rect.width,
  height: entry.rect.height,
  rotation: entry.rotation
})

const toEdgeStructureTuple = (edge: EdgePathEntry['edge']): EdgeStructureTuple => ({
  type: edge.type,
  sourceNodeId: edge.source.nodeId,
  targetNodeId: edge.target.nodeId,
  sourceAnchorSide: edge.source.anchor?.side,
  sourceAnchorOffset: edge.source.anchor?.offset,
  targetAnchorSide: edge.target.anchor?.side,
  targetAnchorOffset: edge.target.anchor?.offset,
  routingMode: edge.routing?.mode,
  routingOrthoOffset: edge.routing?.ortho?.offset,
  routingOrthoRadius: edge.routing?.ortho?.radius,
  routingPointsRef: edge.routing?.points
})

const isSameNodeGeometryTuple = (
  left: NodeGeometryTuple,
  right: NodeGeometryTuple
) =>
  left.x === right.x &&
  left.y === right.y &&
  left.width === right.width &&
  left.height === right.height &&
  left.rotation === right.rotation

const isSameRoutingPoints = (
  left?: readonly { x: number; y: number }[],
  right?: readonly { x: number; y: number }[]
) => {
  if (left === right) return true
  if (!left || !right) return false
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index]?.x !== right[index]?.x) return false
    if (left[index]?.y !== right[index]?.y) return false
  }
  return true
}

const isSameEdgeStructureTuple = (
  left: EdgeStructureTuple,
  right: EdgeStructureTuple
) =>
  left.type === right.type &&
  left.sourceNodeId === right.sourceNodeId &&
  left.targetNodeId === right.targetNodeId &&
  left.sourceAnchorSide === right.sourceAnchorSide &&
  left.sourceAnchorOffset === right.sourceAnchorOffset &&
  left.targetAnchorSide === right.targetAnchorSide &&
  left.targetAnchorOffset === right.targetAnchorOffset &&
  left.routingMode === right.routingMode &&
  left.routingOrthoOffset === right.routingOrthoOffset &&
  left.routingOrthoRadius === right.routingOrthoRadius &&
  isSameRoutingPoints(left.routingPointsRef, right.routingPointsRef)

// Invariants:
// 1) `ids/byId` are derived only from `relations.edgeIds + cacheById`.
// 2) `snapshot` object reference is stable and reads latest state via getters.
// 3) cache reuse is fully data-driven (`refs + tuples`).
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

  const createReconcileMemo = (): ReconcileMemo => ({
    nodeRectById: new Map<NodeId, ReturnType<typeof getNodeRect>>()
  })

  const getNodeRectMemo = (
    memo: ReconcileMemo,
    nodeId: EdgePathEntry['edge']['source']['nodeId']
  ) => {
    if (memo.nodeRectById.has(nodeId)) {
      return memo.nodeRectById.get(nodeId)
    }
    const next = getNodeRect(nodeId)
    memo.nodeRectById.set(nodeId, next)
    return next
  }

  const toEdgeCacheMaterial = (
    edge: EdgePathEntry['edge'],
    memo: ReconcileMemo
  ): EdgeCacheMaterial | undefined => {
    const sourceRectRef = getNodeRectMemo(memo, edge.source.nodeId)
    const targetRectRef = getNodeRectMemo(memo, edge.target.nodeId)
    if (!sourceRectRef || !targetRectRef) return undefined

    return {
      sourceRectRef,
      targetRectRef,
      sourceGeometry: toNodeGeometryTuple(sourceRectRef),
      targetGeometry: toNodeGeometryTuple(targetRectRef),
      structure: toEdgeStructureTuple(edge)
    }
  }

  const reuseCacheEntryByData = (
    edge: EdgePathEntry['edge'],
    material: EdgeCacheMaterial,
    previous?: EdgeCacheEntry
  ): EdgeCacheEntry | undefined => {
    if (!previous) return undefined

    const isSameGeometry = (
      previous.sourceRectRef === material.sourceRectRef &&
      previous.targetRectRef === material.targetRectRef
    ) || (
      isSameNodeGeometryTuple(previous.sourceGeometry, material.sourceGeometry) &&
      isSameNodeGeometryTuple(previous.targetGeometry, material.targetGeometry)
    )
    if (!isSameGeometry) return undefined

    if (!isSameEdgeStructureTuple(previous.structure, material.structure)) {
      return undefined
    }

    if (
      previous.entry.edge === edge &&
      previous.sourceRectRef === material.sourceRectRef &&
      previous.targetRectRef === material.targetRectRef
    ) {
      return previous
    }

    return {
      ...previous,
      sourceRectRef: material.sourceRectRef,
      targetRectRef: material.targetRectRef,
      sourceGeometry: material.sourceGeometry,
      targetGeometry: material.targetGeometry,
      structure: material.structure,
      entry: previous.entry.edge === edge
        ? previous.entry
        : {
          ...previous.entry,
          edge
        }
    }
  }

  const buildCacheEntry = (
    edge: EdgePathEntry['edge'],
    material: EdgeCacheMaterial
  ): EdgeCacheEntry | undefined => {
    const { path, endpoints } = resolveEdgePathFromRects({
      edge,
      source: {
        rect: material.sourceRectRef.rect,
        rotation: material.sourceRectRef.rotation
      },
      target: {
        rect: material.targetRectRef.rect,
        rotation: material.targetRectRef.rotation
      }
    })

    return {
      sourceRectRef: material.sourceRectRef,
      targetRectRef: material.targetRectRef,
      sourceGeometry: material.sourceGeometry,
      targetGeometry: material.targetGeometry,
      structure: material.structure,
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
    previous: EdgeCacheEntry | undefined,
    memo: ReconcileMemo
  ): EdgeCacheEntry | undefined => {
    const material = toEdgeCacheMaterial(edge, memo)
    if (!material) return undefined

    const reusedByData = reuseCacheEntryByData(edge, material, previous)
    if (reusedByData) return reusedByData

    return buildCacheEntry(edge, material)
  }

  const commitEntriesAndView = (nextCacheById: Map<EdgeId, EdgeCacheEntry>) => {
    if (state.cacheById === nextCacheById) return
    state.cacheById = nextCacheById
    rebuildView(state)
  }

  const reconcileAll = (edges: Edge[]) => {
    const previousCacheById = state.cacheById
    state.relations = createEdgeRelations(edges)
    const memo = createReconcileMemo()

    const nextCacheById = new Map<EdgeId, EdgeCacheEntry>()
    state.relations.edgeIds.forEach((edgeId) => {
      const edge = state.relations.edgeById.get(edgeId)
      if (!edge) return
      const nextEntry = toCacheEntry(edge, previousCacheById.get(edgeId), memo)
      if (!nextEntry) return
      nextCacheById.set(edgeId, nextEntry)
    })

    commitEntriesAndView(nextCacheById)
  }

  const reconcileEdges = (edgeIds: ReadonlySet<EdgeId>) => {
    let draftCacheById: Map<EdgeId, EdgeCacheEntry> | undefined
    const memo = createReconcileMemo()

    for (const edgeId of edgeIds) {
      const edge = state.relations.edgeById.get(edgeId)
      const previous = state.cacheById.get(edgeId)
      const next = edge ? toCacheEntry(edge, previous, memo) : undefined
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
