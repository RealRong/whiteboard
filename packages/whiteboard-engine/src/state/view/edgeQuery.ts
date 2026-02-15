import { getEdgePath } from '@whiteboard/core'
import type { Edge, Point } from '@whiteboard/core'
import type {
  EdgePathEntry,
  EdgeResolvedEndpoints,
  Query,
  State
} from '@engine-types/instance'
import type { EdgeConnectState, EdgeReconnectInfo } from '@engine-types/state'
import { toEdgePathSignature, toNodeGeometrySignature } from '../../infra/cache'
import {
  getAnchorPoint,
  getRectCenter
} from '../../infra/geometry'
import { getAutoAnchorFromRect } from '../../infra/query'

type Options = {
  readState: State['read']
  query: Query
}

type EdgeConnectPreview = {
  from?: Point
  to?: Point
  hover?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

type EdgePathCacheEntry = {
  geometrySignature: string
  edge: EdgePathEntry['edge']
  path: EdgePathEntry['path']
  entry: EdgePathEntry
}

type EdgeConnectFrom = NonNullable<EdgeConnectState['from']>
type EdgeConnectTo = NonNullable<EdgeConnectState['to']>

type EdgeConnectPointInput = {
  nodeId?: EdgeConnectFrom['nodeId']
  anchor?: EdgeConnectFrom['anchor']
  pointWorld?: EdgeConnectTo['pointWorld']
}

const isSameEdgePathEntryList = (left: EdgePathEntry[], right: EdgePathEntry[]) => {
  if (left === right) return true
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export const createEdgeViewQuery = ({ readState, query }: Options) => {
  const getResolvedEndpoints = (edge: Edge): EdgeResolvedEndpoints | undefined => {
    const sourceEntry = query.getCanvasNodeRectById(edge.source.nodeId)
    const targetEntry = query.getCanvasNodeRectById(edge.target.nodeId)
    if (!sourceEntry || !targetEntry) return undefined

    const sourceCenter = getRectCenter(sourceEntry.rect)
    const targetCenter = getRectCenter(targetEntry.rect)

    const sourceAuto = getAutoAnchorFromRect(sourceEntry.rect, sourceEntry.rotation, targetCenter)
    const targetAuto = getAutoAnchorFromRect(targetEntry.rect, targetEntry.rotation, sourceCenter)

    const sourceAnchor = edge.source.anchor ?? sourceAuto.anchor
    const targetAnchor = edge.target.anchor ?? targetAuto.anchor

    const sourcePoint = edge.source.anchor
      ? getAnchorPoint(sourceEntry.rect, sourceAnchor, sourceEntry.rotation)
      : sourceAuto.point
    const targetPoint = edge.target.anchor
      ? getAnchorPoint(targetEntry.rect, targetAnchor, targetEntry.rotation)
      : targetAuto.point

    return {
      source: {
        nodeId: sourceEntry.node.id,
        anchor: sourceAnchor,
        point: sourcePoint
      },
      target: {
        nodeId: targetEntry.node.id,
        anchor: targetAnchor,
        point: targetPoint
      }
    }
  }

  const resolveEdgeConnectPoint = (
    value: EdgeConnectPointInput | undefined,
    options: {
      allowPointWorld: boolean
      getCachedEntry: (nodeId: EdgeConnectFrom['nodeId']) => ReturnType<Query['getCanvasNodeRectById']>
    }
  ) => {
    if (!value) return undefined
    if (value.nodeId && value.anchor) {
      const entry = options.getCachedEntry(value.nodeId)
      if (entry) {
        return getAnchorPoint(entry.rect, value.anchor, entry.rotation)
      }
      if (!options.allowPointWorld) return undefined
    }
    if (!options.allowPointWorld) return undefined
    return value.pointWorld
  }

  const getConnectPreview = (edgeConnect: EdgeConnectState): EdgeConnectPreview => {
    const nodeRectCache = new Map<EdgeConnectFrom['nodeId'], ReturnType<Query['getCanvasNodeRectById']> | null>()
    const getCachedEntry = (nodeId: EdgeConnectFrom['nodeId']) => {
      const cached = nodeRectCache.get(nodeId)
      if (cached !== undefined) return cached ?? undefined
      const entry = query.getCanvasNodeRectById(nodeId)
      nodeRectCache.set(nodeId, entry ?? null)
      return entry
    }
    const isPreviewLineMode = edgeConnect.isConnecting && !edgeConnect.reconnect

    const from = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.from, { allowPointWorld: false, getCachedEntry })
      : undefined
    const to = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.to, { allowPointWorld: true, getCachedEntry })
      : undefined
    const hover = resolveEdgeConnectPoint(edgeConnect.hover, { allowPointWorld: true, getCachedEntry })

    return {
      from,
      to,
      hover,
      reconnect: edgeConnect.reconnect,
      showPreviewLine: Boolean(isPreviewLineMode && from && to)
    }
  }

  const getNodeGeometrySignature = (nodeId: EdgePathEntry['edge']['source']['nodeId']) =>
    toNodeGeometrySignature(query.getCanvasNodeRectById(nodeId))

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

    const endpoints = getResolvedEndpoints(edge)
    if (!endpoints) return undefined

    const path = getEdgePath({
      edge,
      source: { point: endpoints.source.point, side: endpoints.source.anchor.side },
      target: { point: endpoints.target.point, side: endpoints.target.anchor.side }
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
  let cachedEdgePathEntryById = new Map<EdgePathEntry['id'], EdgePathCacheEntry>()
  let cachedRenderEdgesRef: unknown
  let cachedRenderNodesRef: unknown

  const ensureEdgePathEntries = () => {
    const edges = readState('visibleEdges')
    const nodes = readState('canvasNodes')
    if (edges === cachedRenderEdgesRef && nodes === cachedRenderNodesRef) return

    cachedRenderEdgesRef = edges
    cachedRenderNodesRef = nodes

    const previousMap = cachedEdgePathEntryById
    const nextMap = new Map<EdgePathEntry['id'], EdgePathCacheEntry>()
    const nextEntries: EdgePathEntry[] = []

    edges.forEach((edge) => {
      const nextEntry = toEdgePathCacheEntry(edge, previousMap.get(edge.id))
      if (!nextEntry) return
      nextMap.set(edge.id, nextEntry)
      nextEntries.push(nextEntry.entry)
    })

    cachedEdgePathEntryById = nextMap
    if (!isSameEdgePathEntryList(cachedEdgePathEntries, nextEntries)) {
      cachedEdgePathEntries = nextEntries
    }
  }

  const resolveReconnectPoint = (
    to: EdgeConnectState['to']
  ): {
    point: ReturnType<typeof getAnchorPoint>
    side?: NonNullable<EdgePathEntry['edge']['source']['anchor']>['side']
  } | undefined => {
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const entry = query.getCanvasNodeRectById(to.nodeId)
      if (entry) {
        return {
          point: getAnchorPoint(entry.rect, to.anchor, entry.rotation),
          side: to.anchor.side
        }
      }
    }
    if (!to.pointWorld) return undefined
    return {
      point: to.pointWorld,
      side: to.anchor?.side
    }
  }

  const getReconnectPathEntry = (edgeConnect: EdgeConnectState): EdgePathEntry | undefined => {
    if (!edgeConnect.isConnecting || !edgeConnect.reconnect) return undefined
    ensureEdgePathEntries()
    const reconnectBase = cachedEdgePathEntryById.get(edgeConnect.reconnect.edgeId)?.entry
    if (!reconnectBase) return undefined

    const moved = resolveReconnectPoint(edgeConnect.to)
    if (!moved) return undefined

    const endpoints = getResolvedEndpoints(reconnectBase.edge)
    if (!endpoints) return undefined

    let source = { point: endpoints.source.point, side: endpoints.source.anchor.side }
    let target = { point: endpoints.target.point, side: endpoints.target.anchor.side }

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

  const getPathEntries = (): EdgePathEntry[] => {
    ensureEdgePathEntries()
    return cachedEdgePathEntries
  }

  return {
    getResolvedEndpoints,
    getPathEntries,
    getReconnectPathEntry,
    getConnectPreview
  }
}
