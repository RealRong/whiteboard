import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import { ConnectTo, getAnchorFromPoint, isSameConnectTo } from '../edge/edgeConnectUtils'

export const createEdgeConnectCommands = (
  instance: WhiteboardInstance
): {
  edgeConnect: WhiteboardCommands['edgeConnect']
} => {
  const { core, config, viewport } = instance.runtime
  const { query } = instance
  const { read, write } = instance.state

  const anchorSnapOptions = {
    snapMin: config.edge.anchorSnapMin,
    snapRatio: config.edge.anchorSnapRatio
  }

  const toWorldFromClient = (clientX: number, clientY: number) => viewport.clientToWorld(clientX, clientY)

  const getEdgeSnapAtPoint = (point: Point): ConnectTo | undefined => {
    const snapThresholdWorld =
      Math.max(
        config.edge.anchorSnapMin,
        Math.min(config.nodeSize.width, config.nodeSize.height) * config.edge.anchorSnapRatio
      ) / Math.max(viewport.getZoom(), 0.0001)
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

      const { anchor, point: anchorPoint } = getAnchorFromPoint(entry.rect, entry.rotation, point, anchorSnapOptions)
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
    write('edgeConnect', (prev) => ({
      ...prev,
      isConnecting: false,
      from: undefined,
      to: undefined,
      reconnect: undefined,
      pointerId: null
    }))
  }

  const startFromPoint = (nodeId: NodeId, pointWorld: Point, pointerId?: number) => {
    const entry = query.getCanvasNodeRectById(nodeId)
    if (!entry) return
    const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld, anchorSnapOptions)
    write('edgeConnect', {
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
      write('edgeConnect', {
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
      const visibleEdges = read('visibleEdges')
      const edge = visibleEdges.find((item) => item.id === edgeId)
      if (!edge) return
      const endpoint = edge[end]
      const anchor = endpoint.anchor ?? { side: 'right', offset: 0.5 }
      write('edgeConnect', {
        isConnecting: true,
        from: { nodeId: endpoint.nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: { edgeId, end },
        pointerId: pointerId ?? null
      })
    },
    updateTo: (pointWorld) => {
      write('edgeConnect', (prev) => {
        if (!prev.isConnecting || !prev.from) return prev
        const snap = getEdgeSnapAtPoint(pointWorld)
        if (snap) {
          return { ...prev, to: snap }
        }
        return { ...prev, to: { pointWorld } }
      })
    },
    updateToClient: (clientX, clientY) => {
      edgeConnect.updateTo(toWorldFromClient(clientX, clientY))
    },
    commitTo: (pointWorld) => {
      const currentState = read('edgeConnect')
      if (!currentState.isConnecting || !currentState.from) return

      const snap = getEdgeSnapAtPoint(pointWorld)
      if (!snap || !snap.nodeId || !snap.anchor) {
        finishEdgeConnect()
        return
      }

      if (currentState.reconnect) {
        const visibleEdges = read('visibleEdges')
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
    commitToClient: (clientX, clientY) => {
      edgeConnect.commitTo(toWorldFromClient(clientX, clientY))
    },
    cancel: finishEdgeConnect,
    updateHover: (pointWorld) => {
      const activeTool = (read('tool') as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return
      const snap = getEdgeSnapAtPoint(pointWorld)
      write('edgeConnect', (prev) => {
        if (prev.isConnecting) return prev
        if (!snap) {
          if (!prev.hover) return prev
          return { ...prev, hover: undefined }
        }
        if (isSameConnectTo(prev.hover, snap)) return prev
        return { ...prev, hover: snap }
      })
    },
    updateHoverAtClient: (clientX, clientY) => {
      edgeConnect.updateHover(toWorldFromClient(clientX, clientY))
    },
    handleNodePointerDown: (nodeId, pointWorld, pointerId) => {
      const activeTool = (read('tool') as 'select' | 'edge') ?? 'select'
      if (activeTool !== 'edge') return false
      startFromPoint(nodeId, pointWorld, pointerId)
      return true
    }
  }

  return {
    edgeConnect
  }
}
