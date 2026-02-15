import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import { type ConnectTo, getAnchorFromPoint, isSameConnectTo } from '../../infra/query'

export class EdgeConnectSystem {
  private readonly instance: WhiteboardInstance
  private readonly anchorSnapOptions: { snapMin: number; snapRatio: number }

  constructor(instance: WhiteboardInstance) {
    this.instance = instance
    this.anchorSnapOptions = {
      snapMin: instance.runtime.config.edge.anchorSnapMin,
      snapRatio: instance.runtime.config.edge.anchorSnapRatio
    }
  }

  private toWorldFromClient = (clientX: number, clientY: number) =>
    this.instance.runtime.viewport.clientToWorld(clientX, clientY)

  private getEdgeSnapAtPoint = (point: Point): ConnectTo | undefined => {
    const { config, viewport } = this.instance.runtime
    const snapThresholdWorld =
      Math.max(
        config.edge.anchorSnapMin,
        Math.min(config.nodeSize.width, config.nodeSize.height) * config.edge.anchorSnapRatio
      ) / Math.max(viewport.getZoom(), 0.0001)
    const nodeRects = this.instance.query.getCanvasNodeRects()
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

      const { anchor, point: anchorPoint } = getAnchorFromPoint(
        entry.rect,
        entry.rotation,
        point,
        this.anchorSnapOptions
      )
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

  private finish = () => {
    this.instance.state.write('edgeConnect', (prev) => ({
      ...prev,
      isConnecting: false,
      from: undefined,
      to: undefined,
      reconnect: undefined,
      pointerId: null
    }))
  }

  startFromHandle: WhiteboardCommands['edgeConnect']['startFromHandle'] = (nodeId, side, pointerId) => {
    const anchor: EdgeAnchor = { side, offset: 0.5 }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  startFromPoint: WhiteboardCommands['edgeConnect']['startFromPoint'] = (nodeId, pointWorld, pointerId) => {
    const entry = this.instance.query.getCanvasNodeRectById(nodeId)
    if (!entry) return
    const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld, this.anchorSnapOptions)
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  startReconnect: WhiteboardCommands['edgeConnect']['startReconnect'] = (edgeId: EdgeId, end, pointerId) => {
    const visibleEdges = this.instance.state.read('visibleEdges')
    const edge = visibleEdges.find((item) => item.id === edgeId)
    if (!edge) return
    const endpoint = edge[end]
    const anchor = endpoint.anchor ?? { side: 'right', offset: 0.5 }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId: endpoint.nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: { edgeId, end },
      pointerId: pointerId ?? null
    })
  }

  updateTo: WhiteboardCommands['edgeConnect']['updateTo'] = (pointWorld) => {
    this.instance.state.write('edgeConnect', (prev) => {
      if (!prev.isConnecting || !prev.from) return prev
      const snap = this.getEdgeSnapAtPoint(pointWorld)
      if (snap) {
        return { ...prev, to: snap }
      }
      return { ...prev, to: { pointWorld } }
    })
  }

  updateToClient: WhiteboardCommands['edgeConnect']['updateToClient'] = (clientX, clientY) => {
    this.updateTo(this.toWorldFromClient(clientX, clientY))
  }

  commitTo: WhiteboardCommands['edgeConnect']['commitTo'] = (pointWorld) => {
    const currentState = this.instance.state.read('edgeConnect')
    if (!currentState.isConnecting || !currentState.from) return

    const snap = this.getEdgeSnapAtPoint(pointWorld)
    if (!snap || !snap.nodeId || !snap.anchor) {
      this.finish()
      return
    }

    if (currentState.reconnect) {
      const visibleEdges = this.instance.state.read('visibleEdges')
      const edge = visibleEdges.find((item) => item.id === currentState.reconnect?.edgeId)
      if (edge) {
        void this.instance.runtime.core.dispatch({
          type: 'edge.update',
          id: edge.id,
          patch:
            currentState.reconnect.end === 'source'
              ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
              : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
        })
      }
    } else {
      void this.instance.runtime.core.dispatch({
        type: 'edge.create',
        payload: {
          source: { nodeId: currentState.from.nodeId, anchor: currentState.from.anchor },
          target: { nodeId: snap.nodeId, anchor: snap.anchor },
          type: 'linear'
        }
      })
    }

    this.finish()
  }

  commitToClient: WhiteboardCommands['edgeConnect']['commitToClient'] = (clientX, clientY) => {
    this.commitTo(this.toWorldFromClient(clientX, clientY))
  }

  cancel: WhiteboardCommands['edgeConnect']['cancel'] = () => {
    this.finish()
  }

  updateHover: WhiteboardCommands['edgeConnect']['updateHover'] = (pointWorld) => {
    const activeTool = (this.instance.state.read('tool') as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return
    const snap = this.getEdgeSnapAtPoint(pointWorld)
    this.instance.state.write('edgeConnect', (prev) => {
      if (prev.isConnecting) return prev
      if (!snap) {
        if (!prev.hover) return prev
        return { ...prev, hover: undefined }
      }
      if (isSameConnectTo(prev.hover, snap)) return prev
      return { ...prev, hover: snap }
    })
  }

  updateHoverAtClient: WhiteboardCommands['edgeConnect']['updateHoverAtClient'] = (clientX, clientY) => {
    this.updateHover(this.toWorldFromClient(clientX, clientY))
  }

  handleNodePointerDown: WhiteboardCommands['edgeConnect']['handleNodePointerDown'] = (
    nodeId,
    pointWorld,
    pointerId
  ) => {
    const activeTool = (this.instance.state.read('tool') as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointWorld, pointerId)
    return true
  }

  createCommands = (): WhiteboardCommands['edgeConnect'] => ({
    startFromHandle: this.startFromHandle,
    startFromPoint: this.startFromPoint,
    startReconnect: this.startReconnect,
    updateTo: this.updateTo,
    updateToClient: this.updateToClient,
    commitTo: this.commitTo,
    commitToClient: this.commitToClient,
    cancel: this.cancel,
    updateHover: this.updateHover,
    updateHoverAtClient: this.updateHoverAtClient,
    handleNodePointerDown: this.handleNodePointerDown
  })
}
