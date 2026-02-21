import { getEdgePath } from '@whiteboard/core'
import type { Edge, EdgeId } from '@whiteboard/core'
import type { EdgePathEntry } from '@engine-types/instance/view'
import type { GraphChange } from '@engine-types/graph'
import type { EdgeConnectState } from '@engine-types/state'
import { toChangeView } from '../../../graph/sync/ChangeView'
import {
  hasDirtyNodeHints,
  shouldResetEdgePathCache
} from '../../../graph/sync/Policy'
import { toEdgePathSignature, toNodeGeometrySignature } from '../../../../../runtime/common/cache'
import type {
  EdgePathCacheEntry,
  EdgePathStore,
  EdgePathStoreOptions
} from './types'

const isSameEdgePathEntryList = (
  left: EdgePathEntry[],
  right: EdgePathEntry[]
) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const createEdgePathStore = ({
  readGraph,
  getNodeRect,
  resolveEndpoints,
  resolveReconnectPoint
}: EdgePathStoreOptions): EdgePathStore => {
  const getNodeGeometrySignature = (
    nodeId: EdgePathEntry['edge']['source']['nodeId']
  ) => toNodeGeometrySignature(getNodeRect(nodeId))

  const getEdgeGeometrySignature = (edge: EdgePathEntry['edge']) =>
    toEdgePathSignature(edge, getNodeGeometrySignature)

  const toEdgePathCacheEntry = (
    edge: EdgePathEntry['edge'],
    previous?: EdgePathCacheEntry
  ): EdgePathCacheEntry | undefined => {
    const geometrySignature = getEdgeGeometrySignature(edge)
    if (previous?.geometrySignature === geometrySignature) {
      if (previous.edge === edge) return previous
      const entry = {
        ...previous.entry,
        edge
      }
      return {
        ...previous,
        edge,
        entry
      }
    }

    const endpoints = resolveEndpoints(edge)
    if (!endpoints) return undefined

    const path = getEdgePath({
      edge,
      source: {
        point: endpoints.source.point,
        side: endpoints.source.anchor.side
      },
      target: {
        point: endpoints.target.point,
        side: endpoints.target.anchor.side
      }
    })

    const entry = {
      id: edge.id,
      edge,
      path
    }

    return {
      geometrySignature,
      edge,
      path,
      entry
    }
  }

  let cachedEdgePathEntries: EdgePathEntry[] = []
  let cachedEdgePathEntryById = new Map<
    EdgePathEntry['id'],
    EdgePathCacheEntry
  >()
  let edgeById = new Map<EdgeId, EdgePathEntry['edge']>()
  let nodeToEdgeIds = new Map<
    EdgePathEntry['edge']['source']['nodeId'],
    Set<EdgeId>
  >()
  let edgeOrderIds: EdgeId[] = []
  let cachedRenderEdgesRef: unknown
  const pendingChangedNodeIds = new Set<
    EdgePathEntry['edge']['source']['nodeId']
  >()

  const rebuildEdgeRefs = (edges: EdgePathEntry['edge'][]) => {
    const nextEdgeById = new Map<EdgeId, EdgePathEntry['edge']>()
    const nextNodeToEdgeIds = new Map<
      EdgePathEntry['edge']['source']['nodeId'],
      Set<EdgeId>
    >()
    const nextEdgeOrderIds: EdgeId[] = []

    edges.forEach((edge) => {
      nextEdgeById.set(edge.id, edge)
      nextEdgeOrderIds.push(edge.id)

      const sourceEdges =
        nextNodeToEdgeIds.get(edge.source.nodeId) ?? new Set<EdgeId>()
      sourceEdges.add(edge.id)
      nextNodeToEdgeIds.set(edge.source.nodeId, sourceEdges)

      const targetEdges =
        nextNodeToEdgeIds.get(edge.target.nodeId) ?? new Set<EdgeId>()
      targetEdges.add(edge.id)
      nextNodeToEdgeIds.set(edge.target.nodeId, targetEdges)
    })

    edgeById = nextEdgeById
    nodeToEdgeIds = nextNodeToEdgeIds
    edgeOrderIds = nextEdgeOrderIds
  }

  const rebuildEntryList = (
    map: Map<EdgePathEntry['id'], EdgePathCacheEntry>
  ) => {
    const nextEntries = edgeOrderIds
      .map((edgeId) => map.get(edgeId)?.entry)
      .filter((entry): entry is EdgePathEntry => Boolean(entry))

    if (!isSameEdgePathEntryList(cachedEdgePathEntries, nextEntries)) {
      cachedEdgePathEntries = nextEntries
    }
  }

  const rebuildEntries = (edges: EdgePathEntry['edge'][]) => {
    const previousMap = cachedEdgePathEntryById
    const nextMap = new Map<EdgePathEntry['id'], EdgePathCacheEntry>()

    edges.forEach((edge) => {
      const nextEntry = toEdgePathCacheEntry(edge, previousMap.get(edge.id))
      if (!nextEntry) return
      nextMap.set(edge.id, nextEntry)
    })

    cachedEdgePathEntryById = nextMap
    rebuildEntryList(nextMap)
  }

  const updateEntriesByDirtyNodes = () => {
    if (!pendingChangedNodeIds.size) return

    const affectedEdgeIds = new Set<EdgeId>()
    pendingChangedNodeIds.forEach((nodeId) => {
      nodeToEdgeIds.get(nodeId)?.forEach((edgeId) => {
        affectedEdgeIds.add(edgeId)
      })
    })
    pendingChangedNodeIds.clear()

    if (!affectedEdgeIds.size) return

    let nextMap = cachedEdgePathEntryById
    let changed = false

    affectedEdgeIds.forEach((edgeId) => {
      const edge = edgeById.get(edgeId)
      if (!edge) return

      const previous = cachedEdgePathEntryById.get(edgeId)
      const next = toEdgePathCacheEntry(edge, previous)

      if (!next) {
        if (!previous) return
        if (!changed) {
          nextMap = new Map(cachedEdgePathEntryById)
          changed = true
        }
        nextMap.delete(edgeId)
        return
      }

      if (previous === next) return
      if (!changed) {
        nextMap = new Map(cachedEdgePathEntryById)
        changed = true
      }
      nextMap.set(edgeId, next)
    })

    if (!changed) return

    cachedEdgePathEntryById = nextMap
    rebuildEntryList(nextMap)
  }

  const ensureEntries = () => {
    const edges = readGraph().visibleEdges
    const edgesChanged = edges !== cachedRenderEdgesRef
    if (edgesChanged) {
      cachedRenderEdgesRef = edges
      pendingChangedNodeIds.clear()
      rebuildEdgeRefs(edges)
      rebuildEntries(edges)
      return
    }

    updateEntriesByDirtyNodes()
  }

  const syncGraph: EdgePathStore['syncGraph'] = (change: GraphChange) => {
    const changeView = toChangeView(change)
    const { fullSync, dirtyNodeIds } = changeView

    if (fullSync) {
      cachedRenderEdgesRef = undefined
      pendingChangedNodeIds.clear()
      return
    }
    if (shouldResetEdgePathCache(changeView)) {
      cachedRenderEdgesRef = undefined
    }
    if (hasDirtyNodeHints(changeView) && dirtyNodeIds) {
      dirtyNodeIds.forEach((nodeId) => {
        pendingChangedNodeIds.add(nodeId)
      })
    }
  }

  const getReconnectEntry = (
    edgeConnect: EdgeConnectState
  ): EdgePathEntry | undefined => {
    if (!edgeConnect.isConnecting || !edgeConnect.reconnect) return undefined
    ensureEntries()

    const reconnectBase = cachedEdgePathEntryById.get(
      edgeConnect.reconnect.edgeId
    )?.entry
    if (!reconnectBase) return undefined

    const moved = resolveReconnectPoint(edgeConnect.to)
    if (!moved) return undefined

    const endpoints = resolveEndpoints(reconnectBase.edge)
    if (!endpoints) return undefined

    let source = {
      point: endpoints.source.point,
      side: endpoints.source.anchor.side
    }
    let target = {
      point: endpoints.target.point,
      side: endpoints.target.anchor.side
    }

    if (edgeConnect.reconnect.end === 'source') {
      source = {
        point: moved.point,
        side: moved.side ?? source.side
      }
    } else {
      target = {
        point: moved.point,
        side: moved.side ?? target.side
      }
    }

    return {
      ...reconnectBase,
      path: getEdgePath({
        edge: reconnectBase.edge,
        source,
        target
      })
    }
  }

  const getEntries = (): EdgePathEntry[] => {
    ensureEntries()
    return cachedEdgePathEntries
  }

  const getEdge = (edgeId: EdgeId): Edge | undefined => {
    ensureEntries()
    return edgeById.get(edgeId)
  }

  return {
    syncGraph,
    getEntries,
    getReconnectEntry,
    getEdge
  }
}
