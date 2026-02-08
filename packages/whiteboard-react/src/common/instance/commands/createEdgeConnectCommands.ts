import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { WhiteboardCommands } from 'types/commands'
import type { WhiteboardInstance } from 'types/instance'
import { edgeConnectAtom, toolAtom, visibleEdgesAtom } from '../../state'
import { ConnectTo, getAnchorFromPoint, isSameConnectTo } from '../edge/edgeConnectUtils'
import { setStoreAtom } from '../store/setStoreAtom'

export const createEdgeConnectCommands = (
  instance: WhiteboardInstance
): {
  edgeConnect: WhiteboardCommands['edgeConnect']
  cancelHoverFrame: () => void
} => {
  const { core, config, viewport } = instance.runtime
  const { query } = instance
  const { store } = instance.state

  const getEdgeSnapAtPoint = (point: Point): ConnectTo | undefined => {
    const snapThresholdWorld =
      Math.max(12, Math.min(config.nodeSize.width, config.nodeSize.height) * 0.18) / Math.max(viewport.getZoom(), 0.0001)
    const nodeRects = query.getCanvasNodeRects()
    let best:
      | {
          nodeId: NodeId
          anchor: EdgeAnchor
          pointWorld: Point
          distance: number
        }
      | undefined

    for (let index = 0; index < nodeRects.length; index += 1) {
      const entry = nodeRects[index]
      const rect = entry.aabb
      const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.width))
      const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.height))
      const outsideDistance = Math.hypot(dx, dy)
      if (outsideDistance > snapThresholdWorld) continue

      const { anchor, point: anchorPoint } = getAnchorFromPoint(entry.rect, entry.rotation, point)
      const distance = Math.hypot(anchorPoint.x - point.x, anchorPoint.y - point.y)
      if (!best || distance < best.distance) {
        best = {
          nodeId: entry.node.id,
          anchor,
          pointWorld: anchorPoint,
          distance
        }
      }
    }

    if (!best) return undefined

    return {
      nodeId: best.nodeId,
      anchor: best.anchor,
      pointWorld: best.pointWorld
    }
  }

  const finishEdgeConnect = () => {
    setStoreAtom(store, edgeConnectAtom, (prev) => ({
      ...prev,
      isConnecting: false,
      from: undefined,
      to: undefined,
      reconnect: undefined,
      pointerId: null
    }))
  }

  let edgeHoverRafId: number | null = null
  let edgeHoverPoint: Point | null = null

  const cancelHoverFrame = () => {
    if (edgeHoverRafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(edgeHoverRafId)
    }
    edgeHoverRafId = null
    edgeHoverPoint = null
  }

  const flushEdgeHover = () => {
    edgeHoverRafId = null
    const pointWorld = edgeHoverPoint
    edgeHoverPoint = null
    if (!pointWorld) return

    const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return

    const snap = getEdgeSnapAtPoint(pointWorld)
    setStoreAtom(store, edgeConnectAtom, (prev) => {
      if (prev.isConnecting) return prev
      if (!snap) {
        if (!prev.hover) return prev
        return { ...prev, hover: undefined }
      }
      if (isSameConnectTo(prev.hover, snap)) return prev
      return { ...prev, hover: snap }
    })
  }

  const startFromPoint = (nodeId: NodeId, pointWorld: Point, pointerId?: number) => {
    const entry = query.getCanvasNodeRectById(nodeId)
    if (!entry) return
    const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld)
    setStoreAtom(store, edgeConnectAtom, {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  const edgeConnect: WhiteboardCommands['edgeConnect'] = {
    startFromHandle: (nodeId, side, pointerId) => {
      const anchor: EdgeAnchor = { side, offset: 0.5 }
      setStoreAtom(store, edgeConnectAtom, {
        isConnecting: true,
        from: { nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: undefined,
        pointerId: pointerId ?? null
      })
    },
    startFromPoint,
    startReconnect: (edgeId: EdgeId, end, pointerId) => {
      const visibleEdges = store.get(visibleEdgesAtom)
      const edge = visibleEdges.find((item) => item.id === edgeId)
      if (!edge) return
      const endpoint = edge[end]
      const anchor = endpoint.anchor ?? { side: 'right', offset: 0.5 }
      setStoreAtom(store, edgeConnectAtom, {
        isConnecting: true,
        from: { nodeId: endpoint.nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: { edgeId, end },
        pointerId: pointerId ?? null
      })
    },
    updateTo: (pointWorld) => {
      setStoreAtom(store, edgeConnectAtom, (prev) => {
        if (!prev.isConnecting || !prev.from) return prev
        const snap = getEdgeSnapAtPoint(pointWorld)
        if (snap) {
          return { ...prev, to: snap }
        }
        return { ...prev, to: { pointWorld } }
      })
    },
    commitTo: (pointWorld) => {
      const currentState = store.get(edgeConnectAtom)
      if (!currentState.isConnecting || !currentState.from) return

      const snap = getEdgeSnapAtPoint(pointWorld)
      if (!snap || !snap.nodeId || !snap.anchor) {
        finishEdgeConnect()
        return
      }

      if (currentState.reconnect) {
        const visibleEdges = store.get(visibleEdgesAtom)
        const edge = visibleEdges.find((item) => item.id === currentState.reconnect?.edgeId)
        if (edge) {
          void core.dispatch({
            type: 'edge.update',
            id: edge.id,
            patch:
              currentState.reconnect.end === 'source'
                ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
          })
        }
      } else {
        void core.dispatch({
          type: 'edge.create',
          payload: {
            source: { nodeId: currentState.from.nodeId, anchor: currentState.from.anchor },
            target: { nodeId: snap.nodeId, anchor: snap.anchor },
            type: 'linear'
          }
        })
      }

      finishEdgeConnect()
    },
    cancel: finishEdgeConnect,
    updateHover: (pointWorld) => {
      const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return
      edgeHoverPoint = pointWorld
      if (edgeHoverRafId !== null) return
      if (typeof requestAnimationFrame === 'undefined') {
        flushEdgeHover()
        return
      }
      edgeHoverRafId = requestAnimationFrame(flushEdgeHover)
    },
    handleNodePointerDown: (nodeId, pointWorld, pointerId) => {
      const activeTool = (store.get(toolAtom) as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return false
      startFromPoint(nodeId, pointWorld, pointerId)
      return true
    }
  }

  return {
    edgeConnect,
    cancelHoverFrame
  }
}
