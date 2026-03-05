import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgePathFromRects,
  type EdgeRelations
} from '@whiteboard/core/edge'
import {
  isSamePointArray,
  isSameRectWithRotationTuple
} from '@whiteboard/core/utils'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import {
  type CanvasNodeRect,
  type EdgeEndpoints,
  type EdgePathEntry
} from '@engine-types/instance/read'
import type { ReadRuntimeContext } from '@engine-types/read/context'
import type {
  EdgeReadCache,
  EdgeReadSnapshot
} from '@engine-types/read/edge'

type EdgeCacheEntry = {
  sourceRectRef: CanvasNodeRect
  targetRectRef: CanvasNodeRect
  sourceGeometry: NodeGeometryTuple
  targetGeometry: NodeGeometryTuple
  structure: EdgeStructureTuple
  endpoints: EdgeEndpoints
  entry: EdgePathEntry
}

type EdgeCacheState = {
  relations: EdgeRelations
  cacheById: Map<EdgeId, EdgeCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgePathEntry>
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

const EDGE_STRUCTURE_SCALAR_KEYS = [
  'type',
  'sourceNodeId',
  'targetNodeId',
  'sourceAnchorSide',
  'sourceAnchorOffset',
  'targetAnchorSide',
  'targetAnchorOffset',
  'routingMode',
  'routingOrthoOffset',
  'routingOrthoRadius'
] as const satisfies readonly (Exclude<keyof EdgeStructureTuple, 'routingPointsRef'>)[]

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

const isSameEdgeStructureTuple = (
  left: EdgeStructureTuple,
  right: EdgeStructureTuple
) => {
  for (const key of EDGE_STRUCTURE_SCALAR_KEYS) {
    if (left[key] !== right[key]) return false
  }
  return isSamePointArray(left.routingPointsRef, right.routingPointsRef)
}

// Invariants:
// 1) `ids/byId` are derived only from `relations.edgeIds + cacheById`.
// 2) `snapshot` object reference is stable and reads latest state via getters.
// 3) cache reuse is fully data-driven (`refs + tuples`).
export const cache = (context: ReadRuntimeContext): EdgeReadCache => {
  const getNodeRect = context.query.canvas.nodeRect
  const readModelSnapshot = () => context.snapshot()
  const state = emptyState()
  let visibleEdgesRef: ReturnType<typeof readModelSnapshot>['edges']['visible'] | undefined
  let pendingDirtyNodeIds = new Set<NodeId>()
  let pendingDirtyEdgeIds = new Set<EdgeId>()

  const snapshot: EdgeReadSnapshot = {
    get ids() {
      return state.ids
    },
    get byId() {
      return state.byId
    },
    getEndpoints: (edgeId) => state.cacheById.get(edgeId)?.endpoints
  }

  const toEdgeCacheMaterial = (
    edge: EdgePathEntry['edge']
  ): EdgeCacheMaterial | undefined => {
    const sourceRectRef = getNodeRect(edge.source.nodeId)
    const targetRectRef = getNodeRect(edge.target.nodeId)
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
      isSameRectWithRotationTuple(previous.sourceGeometry, material.sourceGeometry) &&
      isSameRectWithRotationTuple(previous.targetGeometry, material.targetGeometry)
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
    previous: EdgeCacheEntry | undefined
  ): EdgeCacheEntry | undefined => {
    const material = toEdgeCacheMaterial(edge)
    if (!material) return undefined

    const reusedByData = reuseCacheEntryByData(edge, material, previous)
    if (reusedByData) return reusedByData

    return buildCacheEntry(edge, material)
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

    state.cacheById = nextCacheById
    rebuildView(state)
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

    if (!draftCacheById) return
    state.cacheById = draftCacheById
    rebuildView(state)
  }

  const ensureEntries = () => {
    const visibleEdges = readModelSnapshot().edges.visible
    if (visibleEdges !== visibleEdgesRef) {
      visibleEdgesRef = visibleEdges
      pendingDirtyNodeIds = new Set<NodeId>()
      pendingDirtyEdgeIds = new Set<EdgeId>()
      reconcileAll(visibleEdges)
      return
    }

    if (!pendingDirtyNodeIds.size && !pendingDirtyEdgeIds.size) return

    const dirtyNodeIds = pendingDirtyNodeIds
    const dirtyEdgeIds = pendingDirtyEdgeIds
    pendingDirtyNodeIds = new Set<NodeId>()
    pendingDirtyEdgeIds = new Set<EdgeId>()

    const affectedEdgeIds = new Set<EdgeId>()
    if (dirtyNodeIds.size) {
      const fromNodes = collectRelatedEdgeIds(
        state.relations.nodeToEdgeIds,
        dirtyNodeIds
      )
      fromNodes.forEach((edgeId) => {
        affectedEdgeIds.add(edgeId)
      })
    }
    dirtyEdgeIds.forEach((edgeId) => {
      affectedEdgeIds.add(edgeId)
    })
    if (!affectedEdgeIds.size) return

    reconcileEdges(affectedEdgeIds)
  }

  const applyPlan: EdgeReadCache['applyPlan'] = (plan) => {
    if (plan.rebuild === 'none') return

    if (plan.rebuild === 'full') {
      visibleEdgesRef = undefined
      pendingDirtyNodeIds = new Set<NodeId>()
      pendingDirtyEdgeIds = new Set<EdgeId>()
      return
    }

    if (plan.dirtyNodeIds.length) {
      plan.dirtyNodeIds.forEach((nodeId) => {
        pendingDirtyNodeIds.add(nodeId)
      })
    }

    if (plan.dirtyEdgeIds.length) {
      plan.dirtyEdgeIds.forEach((edgeId) => {
        pendingDirtyEdgeIds.add(edgeId)
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
