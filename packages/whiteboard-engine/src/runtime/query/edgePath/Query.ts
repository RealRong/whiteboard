import { getEdgePath } from '@whiteboard/core/edge'
import { toEdgePathSignature, toNodeGeometrySignature } from '@whiteboard/core/cache'
import type { EdgePathEntry } from '@engine-types/instance/view'
import type { EdgeConnectState } from '@engine-types/state'
import { Cache } from './Cache'
import { Index } from './Index'
import { Invalidation } from './Invalidation'
import { Preview } from './Preview'
import type {
  EdgePathCacheEntry,
  EdgePathStore,
  EdgePathStoreOptions
} from './types'

export const createEdgePathStore = ({
  readProjection,
  getNodeRect,
  resolveEndpoints,
  resolveReconnectPoint
}: EdgePathStoreOptions): EdgePathStore => {
  const getNodeGeometrySignature = (
    nodeId: EdgePathEntry['edge']['source']['nodeId']
  ) => toNodeGeometrySignature(getNodeRect(nodeId))

  const getEdgeGeometrySignature = (edge: EdgePathEntry['edge']) =>
    toEdgePathSignature(edge, getNodeGeometrySignature)

  const toCacheEntry = (
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

  const index = new Index()
  const cache = new Cache({
    toCacheEntry
  })
  const invalidation = new Invalidation()
  const preview = new Preview({
    resolveEndpoints,
    resolveReconnectPoint
  })

  const ensureEntries = () => {
    const plan = invalidation.consume(readProjection)
    if (plan.edgesChanged) {
      index.rebuild(plan.edges)
      cache.rebuild(plan.edges)
      return
    }

    if (!plan.dirtyNodeIds.size) return
    const affectedEdgeIds = index.collectEdgeIdsByNodeIds(plan.dirtyNodeIds)
    if (!affectedEdgeIds.size) return
    cache.updateByEdgeIds({
      edgeIds: affectedEdgeIds,
      getEdge: index.getEdge,
      orderIds: index.getOrderIds()
    })
  }

  const applyCommit: EdgePathStore['applyCommit'] = (commit) => {
    invalidation.onProjectionCommit(commit)
  }

  const getReconnectEntry = (edgeConnect: EdgeConnectState, isConnecting: boolean) => {
    if (!isConnecting || !edgeConnect.reconnect) return undefined
    ensureEntries()

    const reconnectBase = cache.getEntryById(edgeConnect.reconnect.edgeId)?.entry
    if (!reconnectBase) return undefined

    return preview.createReconnectEntry(edgeConnect, reconnectBase)
  }

  const getEntries: EdgePathStore['getEntries'] = () => {
    ensureEntries()
    return cache.getEntries()
  }

  const getEdge: EdgePathStore['getEdge'] = (edgeId) => {
    ensureEntries()
    return index.getEdge(edgeId)
  }

  return {
    applyCommit,
    getEntries,
    getReconnectEntry,
    getEdge
  }
}
