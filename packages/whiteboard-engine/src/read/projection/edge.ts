import {
  collectRelatedEdgeIds,
  createEdgeRelations,
  resolveEdgeEndpoints,
  type EdgeRelations
} from '@whiteboard/core/edge'
import {
  isSamePointArray,
  isSameRectWithRotationTuple
} from '@whiteboard/core/utils'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
import {
  type CanvasNodeRect,
  type EdgeEntry
} from '@engine-types/instance'
import type { EdgeReadProjection, ReadContext } from '@engine-types/read'

type EdgeCacheEntry = {
  sourceRectRef: CanvasNodeRect
  targetRectRef: CanvasNodeRect
  sourceGeometry: NodeGeometryTuple
  targetGeometry: NodeGeometryTuple
  structure: EdgeStructureTuple
  entry: EdgeEntry
}

type EdgeCacheState = {
  relations: EdgeRelations
  cacheById: Map<EdgeId, EdgeCacheEntry>
  ids: EdgeId[]
  byId: Map<EdgeId, EdgeEntry>
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
  byId: new Map<EdgeId, EdgeEntry>()
})

const subscribeListener = (
  listeners: Set<() => void>,
  listener: () => void
) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const notifyListeners = (listeners: ReadonlySet<() => void>) => {
  listeners.forEach((listener) => {
    listener()
  })
}

const isSameView = (
  prevIds: readonly EdgeId[],
  prevById: ReadonlyMap<EdgeId, EdgeEntry>,
  nextIds: readonly EdgeId[],
  nextById: ReadonlyMap<EdgeId, EdgeEntry>
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
  const nextById = new Map<EdgeId, EdgeEntry>()

  state.relations.edgeIds.forEach((edgeId) => {
    const entry = state.cacheById.get(edgeId)?.entry
    if (!entry) return
    nextIds.push(edgeId)
    nextById.set(edgeId, entry)
  })

  if (isSameView(state.ids, state.byId, nextIds, nextById)) return false

  state.ids = nextIds
  state.byId = nextById
  return true
}

const toNodeGeometryTuple = (entry: CanvasNodeRect): NodeGeometryTuple => ({
  x: entry.rect.x,
  y: entry.rect.y,
  width: entry.rect.width,
  height: entry.rect.height,
  rotation: entry.rotation
})

const toEdgeStructureTuple = (edge: EdgeEntry['edge']): EdgeStructureTuple => ({
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

export const projection = (context: ReadContext): EdgeReadProjection => {
  const getNodeRect = context.indexes.node.byId
  const readModel = () => context.model()
  const state = emptyState()
  const idsListeners = new Set<() => void>()
  const listenersById = new Map<EdgeId, Set<() => void>>()
  let visibleEdgesRef: ReturnType<typeof readModel>['edges']['visible'] | undefined

  const toEdgeCacheMaterial = (
    edge: EdgeEntry['edge']
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
    edge: EdgeEntry['edge'],
    material: EdgeCacheMaterial,
    previous?: EdgeCacheEntry
  ): EdgeCacheEntry | undefined => {
    if (!previous) return undefined

    const isSameGeometry = (
      previous.sourceRectRef === material.sourceRectRef
      && previous.targetRectRef === material.targetRectRef
    ) || (
      isSameRectWithRotationTuple(previous.sourceGeometry, material.sourceGeometry)
      && isSameRectWithRotationTuple(previous.targetGeometry, material.targetGeometry)
    )
    if (!isSameGeometry) return undefined

    if (!isSameEdgeStructureTuple(previous.structure, material.structure)) {
      return undefined
    }

    if (
      previous.entry.edge === edge
      && previous.sourceRectRef === material.sourceRectRef
      && previous.targetRectRef === material.targetRectRef
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
    edge: EdgeEntry['edge'],
    material: EdgeCacheMaterial
  ): EdgeCacheEntry | undefined => {
    const endpoints = resolveEdgeEndpoints({
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
      entry: {
        id: edge.id,
        edge,
        endpoints
      }
    }
  }

  const toCacheEntry = (
    edge: EdgeEntry['edge'],
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
    const changedEdgeIds = new Set<EdgeId>()
    const previousEdgeIds = new Set(previousCacheById.keys())

    state.relations.edgeIds.forEach((edgeId) => {
      const edge = state.relations.edgeById.get(edgeId)
      if (!edge) return
      const nextEntry = toCacheEntry(edge, previousCacheById.get(edgeId))
      if (!nextEntry) return
      nextCacheById.set(edgeId, nextEntry)
      if (previousCacheById.get(edgeId) !== nextEntry) {
        changedEdgeIds.add(edgeId)
      }
      previousEdgeIds.delete(edgeId)
    })

    previousEdgeIds.forEach((edgeId) => {
      changedEdgeIds.add(edgeId)
    })

    state.cacheById = nextCacheById
    const idsChanged = rebuildView(state)
    return {
      idsChanged,
      changedEdgeIds
    }
  }

  const reconcileEdges = (edgeIds: ReadonlySet<EdgeId>) => {
    let draftCacheById: Map<EdgeId, EdgeCacheEntry> | undefined
    const changedEdgeIds = new Set<EdgeId>()

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
      changedEdgeIds.add(edgeId)
    }

    if (!draftCacheById) {
      return {
        idsChanged: false,
        changedEdgeIds
      }
    }

    state.cacheById = draftCacheById
    const idsChanged = rebuildView(state)
    return {
      idsChanged,
      changedEdgeIds
    }
  }

  const ensureSynced = () => {
    const visibleEdges = readModel().edges.visible
    if (visibleEdges === visibleEdgesRef) return
    visibleEdgesRef = visibleEdges
    reconcileAll(visibleEdges)
  }

  const ids = () => {
    ensureSynced()
    return state.ids
  }

  const get = (edgeId: EdgeId) => {
    ensureSynced()
    return state.byId.get(edgeId)
  }

  const subscribe = (edgeId: EdgeId, listener: () => void) => {
    const edgeListeners = listenersById.get(edgeId) ?? new Set<() => void>()
    if (!listenersById.has(edgeId)) {
      listenersById.set(edgeId, edgeListeners)
    }
    edgeListeners.add(listener)
    return () => {
      edgeListeners.delete(listener)
      if (!edgeListeners.size) {
        listenersById.delete(edgeId)
      }
    }
  }

  const subscribeIds = (listener: () => void) => subscribeListener(idsListeners, listener)

  const notifyEdge = (edgeId: EdgeId) => {
    const edgeListeners = listenersById.get(edgeId)
    if (!edgeListeners?.size) return
    notifyListeners(edgeListeners)
  }

  const applyChange: EdgeReadProjection['applyChange'] = (rebuild, nodeIds, edgeIds) => {
    if (rebuild === 'none') return

    const visibleEdges = readModel().edges.visible
    const visibleEdgesChanged = visibleEdges !== visibleEdgesRef
    let idsChanged = false
    let changedEdgeIds = new Set<EdgeId>()

    if (rebuild === 'full' || visibleEdgesChanged) {
      visibleEdgesRef = visibleEdges
      const next = reconcileAll(visibleEdges)
      idsChanged = next.idsChanged
      changedEdgeIds = next.changedEdgeIds
    } else {
      const affectedEdgeIds = new Set<EdgeId>()
      if (nodeIds.length) {
        const fromNodes = collectRelatedEdgeIds(
          state.relations.nodeToEdgeIds,
          new Set(nodeIds)
        )
        fromNodes.forEach((edgeId) => {
          affectedEdgeIds.add(edgeId)
        })
      }
      edgeIds.forEach((edgeId) => {
        affectedEdgeIds.add(edgeId)
      })
      const next = reconcileEdges(affectedEdgeIds)
      idsChanged = next.idsChanged
      changedEdgeIds = next.changedEdgeIds
    }

    if (idsChanged) {
      notifyListeners(idsListeners)
    }

    changedEdgeIds.forEach((edgeId) => {
      notifyEdge(edgeId)
    })
  }

  return {
    ids,
    get,
    subscribe,
    subscribeIds,
    applyChange
  }
}
