import type { KernelReadImpact } from '@whiteboard/core/kernel'
import type { Edge, EdgeId, NodeId } from '@whiteboard/core/types'
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
import type {
  CanvasNodeRect,
  EdgeEntry
} from '@engine-types/instance'
import { notifyListeners, subscribeListener } from './subscriptions'
import type { ReadSnapshot } from './types'

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

type EdgeProjectionUpdate = {
  nextState: EdgeCacheState
  idsChanged: boolean
  changedEdgeIds: Set<EdgeId>
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

const buildView = ({
  relations,
  cacheById,
  prevIds,
  prevById
}: {
  relations: EdgeRelations
  cacheById: ReadonlyMap<EdgeId, EdgeCacheEntry>
  prevIds: readonly EdgeId[]
  prevById: ReadonlyMap<EdgeId, EdgeEntry>
}) => {
  const nextIds: EdgeId[] = []
  const nextById = new Map<EdgeId, EdgeEntry>()

  relations.edgeIds.forEach((edgeId) => {
    const entry = cacheById.get(edgeId)?.entry
    if (!entry) return
    nextIds.push(edgeId)
    nextById.set(edgeId, entry)
  })

  const idsChanged = !isSameView(prevIds, prevById, nextIds, nextById)

  return {
    ids: idsChanged ? nextIds : prevIds as EdgeId[],
    byId: idsChanged ? nextById : prevById as Map<EdgeId, EdgeEntry>,
    idsChanged
  }
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

const resolveEdgeRebuild = (impact: KernelReadImpact): 'none' | 'dirty' | 'full' => {
  if (impact.reset || impact.node.list || impact.edge.list) {
    return 'full'
  }

  const hasDirtyIds =
    impact.edge.ids.length > 0
    || impact.edge.nodeIds.length > 0

  if (hasDirtyIds) {
    return 'dirty'
  }

  if (impact.node.geometry || impact.edge.geometry || impact.edge.value) {
    return 'full'
  }

  return 'none'
}

export const createEdgeProjection = (initialSnapshot: ReadSnapshot) => {
  const getNodeRect = (snapshot: ReadSnapshot) => snapshot.indexes.node.byId
  const readModel = (snapshot: ReadSnapshot) => snapshot.model
  const state = emptyState()
  const idsListeners = new Set<() => void>()
  const listenersById = new Map<EdgeId, Set<() => void>>()
  let snapshotRef: ReadSnapshot = initialSnapshot
  let visibleEdgesRef: ReadSnapshot['model']['edges']['visible'] | undefined

  const toEdgeCacheMaterial = (
    edge: EdgeEntry['edge']
  ): EdgeCacheMaterial | undefined => {
    const sourceRectRef = getNodeRect(snapshotRef)(edge.source.nodeId)
    const targetRectRef = getNodeRect(snapshotRef)(edge.target.nodeId)
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

    const nextEntry: EdgeEntry = {
      id: edge.id,
      edge,
      endpoints: previous.entry.endpoints
    }
    return {
      sourceRectRef: material.sourceRectRef,
      targetRectRef: material.targetRectRef,
      sourceGeometry: material.sourceGeometry,
      targetGeometry: material.targetGeometry,
      structure: material.structure,
      entry: nextEntry
    }
  }

  const buildCacheEntry = (
    edge: EdgeEntry['edge'],
    material: EdgeCacheMaterial
  ): EdgeCacheEntry | undefined => {
    const sourceRectRef = material.sourceRectRef
    const targetRectRef = material.targetRectRef
    const endpoints = resolveEdgeEndpoints({
      edge,
      source: sourceRectRef,
      target: targetRectRef
    })
    if (!endpoints) return undefined

    return {
      sourceRectRef,
      targetRectRef,
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

  const commitState = (nextState: EdgeCacheState) => {
    state.relations = nextState.relations
    state.cacheById = nextState.cacheById
    state.ids = nextState.ids
    state.byId = nextState.byId
  }

  const reconcileEdges = (
    current: EdgeCacheState,
    edgeIds: ReadonlySet<EdgeId>
  ): EdgeProjectionUpdate => {
    const previous = current.cacheById
    const nextCacheById = new Map(previous)
    const changedEdgeIds = new Set<EdgeId>()

    edgeIds.forEach((edgeId) => {
      const edge = current.relations.edgeById.get(edgeId)
      if (!edge) {
        nextCacheById.delete(edgeId)
        changedEdgeIds.add(edgeId)
        return
      }

      const material = toEdgeCacheMaterial(edge)
      if (!material) {
        nextCacheById.delete(edgeId)
        changedEdgeIds.add(edgeId)
        return
      }

      const previousEntry = previous.get(edgeId)
      const reused = reuseCacheEntryByData(edge, material, previousEntry)
      if (reused) {
        nextCacheById.set(edgeId, reused)
        if (reused !== previousEntry) {
          changedEdgeIds.add(edgeId)
        }
        return
      }

      const nextEntry = buildCacheEntry(edge, material)
      if (nextEntry) {
        nextCacheById.set(edgeId, nextEntry)
      } else {
        nextCacheById.delete(edgeId)
      }
      if (nextEntry !== previousEntry) {
        changedEdgeIds.add(edgeId)
      }
    })

    const nextView = buildView({
      relations: current.relations,
      cacheById: nextCacheById,
      prevIds: current.ids,
      prevById: current.byId
    })

    return {
      nextState: {
        relations: current.relations,
        cacheById: nextCacheById,
        ids: nextView.ids,
        byId: nextView.byId
      },
      idsChanged: nextView.idsChanged,
      changedEdgeIds
    }
  }

  const reconcileAll = (
    current: EdgeCacheState,
    edges: readonly Edge[]
  ): EdgeProjectionUpdate => {
    const relations = createEdgeRelations(edges)
    const changedEdgeIds = new Set<EdgeId>()

    const nextCacheById = new Map<EdgeId, EdgeCacheEntry>()
    relations.edgeIds.forEach((edgeId) => {
      const edge = relations.edgeById.get(edgeId)
      if (!edge) return

      const material = toEdgeCacheMaterial(edge)
      if (!material) return

      const previousEntry = current.cacheById.get(edgeId)
      const reused = reuseCacheEntryByData(edge, material, previousEntry)
      if (reused) {
        nextCacheById.set(edgeId, reused)
        if (reused !== previousEntry) {
          changedEdgeIds.add(edgeId)
        }
        return
      }

      const nextEntry = buildCacheEntry(edge, material)
      if (nextEntry) {
        nextCacheById.set(edgeId, nextEntry)
      }
      if (nextEntry !== previousEntry) {
        changedEdgeIds.add(edgeId)
      }
    })

    current.ids.forEach((edgeId) => {
      if (!nextCacheById.has(edgeId)) {
        changedEdgeIds.add(edgeId)
      }
    })

    const nextView = buildView({
      relations,
      cacheById: nextCacheById,
      prevIds: current.ids,
      prevById: current.byId
    })

    return {
      nextState: {
        relations,
        cacheById: nextCacheById,
        ids: nextView.ids,
        byId: nextView.byId
      },
      idsChanged: nextView.idsChanged,
      changedEdgeIds
    }
  }

  const ensureSynced = () => {
    if (visibleEdgesRef !== readModel(snapshotRef).edges.visible) {
      const visibleEdges = readModel(snapshotRef).edges.visible
      const next = reconcileAll(state, visibleEdges)
      commitState(next.nextState)
      visibleEdgesRef = visibleEdges
    }
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

  const applyChange = (impact: KernelReadImpact, snapshot: ReadSnapshot) => {
    snapshotRef = snapshot
    const rebuild = resolveEdgeRebuild(impact)
    if (rebuild === 'none') return

    const visibleEdges = readModel(snapshotRef).edges.visible
    const visibleEdgesChanged = visibleEdges !== visibleEdgesRef
    let idsChanged = false
    let changedEdgeIds = new Set<EdgeId>()

    if (rebuild === 'full' || visibleEdgesChanged) {
      const next = reconcileAll(state, visibleEdges)
      commitState(next.nextState)
      visibleEdgesRef = visibleEdges
      idsChanged = next.idsChanged
      changedEdgeIds = next.changedEdgeIds
    } else {
      const affectedEdgeIds = new Set<EdgeId>()
      if (impact.edge.nodeIds.length) {
        const fromNodes = collectRelatedEdgeIds(
          state.relations.nodeToEdgeIds,
          new Set(impact.edge.nodeIds)
        )
        fromNodes.forEach((edgeId) => {
          affectedEdgeIds.add(edgeId)
        })
      }
      impact.edge.ids.forEach((edgeId) => {
        affectedEdgeIds.add(edgeId)
      })
      const next = reconcileEdges(state, affectedEdgeIds)
      commitState(next.nextState)
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
