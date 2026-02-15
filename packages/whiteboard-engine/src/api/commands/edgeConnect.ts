import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { type ConnectTo, getAnchorFromPoint, isSameConnectTo } from '../../infra/query'

class Connect {
  private readonly instance: Instance
  private readonly anchorSnap: { snapMin: number; snapRatio: number }

  constructor(instance: Instance) {
    this.instance = instance
    this.anchorSnap = {
      snapMin: instance.runtime.config.edge.anchorSnapMin,
      snapRatio: instance.runtime.config.edge.anchorSnapRatio
    }
  }

  private toWorld = (clientX: number, clientY: number) =>
    this.instance.runtime.viewport.clientToWorld(clientX, clientY)

  private snapAt = (point: Point): ConnectTo | undefined => {
    const { config, viewport } = this.instance.runtime
    const snapThresholdWorld =
      Math.max(
        config.edge.anchorSnapMin,
        Math.min(config.nodeSize.width, config.nodeSize.height) * config.edge.anchorSnapRatio
      ) / Math.max(viewport.getZoom(), 0.0001)
    const nodeRects = this.instance.query.getNodeRects()
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
        this.anchorSnap
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

  startFromHandle: Commands['edgeConnect']['startFromHandle'] = (nodeId, side, pointerId) => {
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

  startFromPoint: Commands['edgeConnect']['startFromPoint'] = (nodeId, pointWorld, pointerId) => {
    const entry = this.instance.query.getNodeRectById(nodeId)
    if (!entry) return
    const { anchor } = getAnchorFromPoint(entry.rect, entry.rotation, pointWorld, this.anchorSnap)
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  startReconnect: Commands['edgeConnect']['startReconnect'] = (edgeId: EdgeId, end, pointerId) => {
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

  updateTo: Commands['edgeConnect']['updateTo'] = (pointWorld) => {
    this.instance.state.write('edgeConnect', (prev) => {
      if (!prev.isConnecting || !prev.from) return prev
      const snap = this.snapAt(pointWorld)
      if (snap) {
        return { ...prev, to: snap }
      }
      return { ...prev, to: { pointWorld } }
    })
  }

  updateToClient: Commands['edgeConnect']['updateToClient'] = (clientX, clientY) => {
    this.updateTo(this.toWorld(clientX, clientY))
  }

  commitTo: Commands['edgeConnect']['commitTo'] = (pointWorld) => {
    const currentState = this.instance.state.read('edgeConnect')
    if (!currentState.isConnecting || !currentState.from) return

    const snap = this.snapAt(pointWorld)
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

  commitToClient: Commands['edgeConnect']['commitToClient'] = (clientX, clientY) => {
    this.commitTo(this.toWorld(clientX, clientY))
  }

  cancel: Commands['edgeConnect']['cancel'] = () => {
    this.finish()
  }

  updateHover: Commands['edgeConnect']['updateHover'] = (pointWorld) => {
    const activeTool = (this.instance.state.read('tool') as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return
    const snap = this.snapAt(pointWorld)
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

  updateHoverAtClient: Commands['edgeConnect']['updateHoverAtClient'] = (clientX, clientY) => {
    this.updateHover(this.toWorld(clientX, clientY))
  }

  handleNodePointerDown: Commands['edgeConnect']['handleNodePointerDown'] = (
    nodeId,
    pointWorld,
    pointerId
  ) => {
    const activeTool = (this.instance.state.read('tool') as 'select' | 'edge') ?? 'select'
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointWorld, pointerId)
    return true
  }

  createCommands = (): Commands['edgeConnect'] => ({
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

export const createEdgeConnect = (instance: Instance): Commands['edgeConnect'] => {
  return new Connect(instance).createCommands()
}
