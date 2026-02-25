import type { EdgeConnectState } from '@engine-types/state'
import { getAnchorPoint } from '@whiteboard/core/geometry'
import type {
  EdgeConnectFrom,
  EdgeConnectPointInput,
  EdgeConnectPreview,
  NodeRectReader,
  ReconnectPoint
} from './types'

type Options = {
  getNodeRect: NodeRectReader
}

const resolveEdgeConnectPoint = (
  value: EdgeConnectPointInput | undefined,
  options: {
    allowPointWorld: boolean
    getCachedEntry: (nodeId: EdgeConnectFrom['nodeId']) => ReturnType<NodeRectReader>
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

export const createEdgePreviewResolver = ({
  getNodeRect
}: Options) => {
  const getPreview = (
    edgeConnect: EdgeConnectState,
    isConnecting: boolean
  ): EdgeConnectPreview => {
    const nodeRectCache = new Map<EdgeConnectFrom['nodeId'], ReturnType<NodeRectReader> | null>()
    const getCachedEntry = (nodeId: EdgeConnectFrom['nodeId']) => {
      const cached = nodeRectCache.get(nodeId)
      if (cached !== undefined) return cached ?? undefined
      const entry = getNodeRect(nodeId)
      nodeRectCache.set(nodeId, entry ?? null)
      return entry
    }
    const isPreviewLineMode =
      isConnecting && !edgeConnect.reconnect

    const from = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.from, {
          allowPointWorld: false,
          getCachedEntry
        })
      : undefined
    const to = isPreviewLineMode
      ? resolveEdgeConnectPoint(edgeConnect.to, {
          allowPointWorld: true,
          getCachedEntry
        })
      : undefined
    const hover = resolveEdgeConnectPoint(edgeConnect.hover, {
      allowPointWorld: true,
      getCachedEntry
    })

    return {
      from,
      to,
      hover,
      reconnect: edgeConnect.reconnect,
      showPreviewLine: Boolean(isPreviewLineMode && from && to)
    }
  }

  const resolveReconnectPoint = (
    to: EdgeConnectState['to']
  ): ReconnectPoint | undefined => {
    if (!to) return undefined
    if (to.nodeId && to.anchor) {
      const entry = getNodeRect(to.nodeId)
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

  return {
    getPreview,
    resolveReconnectPoint
  }
}
