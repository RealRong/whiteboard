import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { Instance } from '@engine-types/instance/instance'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../config'
import { type ConnectTo, isSameConnectTo } from '../../kernel/query'

type EdgeConnectInteraction = RuntimeInteraction['edgeConnect']
type ClientPoint = { x: number; y: number }

export class EdgeConnect implements EdgeConnectInteraction {
  private readonly instance: Instance
  private hoverPoint: ClientPoint | null = null
  private hoverRafId: number | null = null

  constructor(instance: Instance) {
    this.instance = instance
  }

  private flushHover = () => {
    this.hoverRafId = null
    const point = this.hoverPoint
    if (!point) return
    this.hoverPoint = null
    const pointWorld = this.instance.runtime.viewport.clientToWorld(point.x, point.y)
    this.updateHover(pointWorld)
  }

  private snapAt = (point: Point): ConnectTo | undefined => {
    const { config, viewport } = this.instance.runtime
    const snapThresholdWorld =
      Math.max(
        config.edge.anchorSnapMin,
        Math.min(config.nodeSize.width, config.nodeSize.height) * config.edge.anchorSnapRatio
      ) / Math.max(viewport.getZoom(), DEFAULT_INTERNALS.zoomEpsilon)
    const nodeRects = this.instance.query.canvas.nodeRects()
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

      const { anchor, point: anchorPoint } = this.instance.query.geometry.anchorFromPoint(entry.rect, entry.rotation, point)
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

  startFromHandle: RuntimeInteraction['edgeConnect']['startFromHandle'] = (nodeId, side, pointerId) => {
    const anchor: EdgeAnchor = { side, offset: DEFAULT_TUNING.edge.anchorOffset }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  startFromPoint: RuntimeInteraction['edgeConnect']['startFromPoint'] = (nodeId, pointWorld, pointerId) => {
    const entry = this.instance.query.canvas.nodeRect(nodeId)
    if (!entry) return
    const { anchor } = this.instance.query.geometry.anchorFromPoint(entry.rect, entry.rotation, pointWorld)
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointerId ?? null
    })
  }

  startReconnect: RuntimeInteraction['edgeConnect']['startReconnect'] = (edgeId: EdgeId, end, pointerId) => {
    const visibleEdges = this.instance.graph.read().visibleEdges
    const edge = visibleEdges.find((item) => item.id === edgeId)
    if (!edge) return
    const endpoint = edge[end]
    const anchor = endpoint.anchor ?? { side: 'right', offset: DEFAULT_TUNING.edge.anchorOffset }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId: endpoint.nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: { edgeId, end },
      pointerId: pointerId ?? null
    })
  }

  updateTo: RuntimeInteraction['edgeConnect']['updateTo'] = (pointWorld) => {
    this.instance.state.write('edgeConnect', (prev) => {
      if (!prev.isConnecting || !prev.from) return prev
      const snap = this.snapAt(pointWorld)
      if (snap) {
        return { ...prev, to: snap }
      }
      return { ...prev, to: { pointWorld } }
    })
  }

  commitTo: RuntimeInteraction['edgeConnect']['commitTo'] = (pointWorld) => {
    const currentState = this.instance.state.read('edgeConnect')
    if (!currentState.isConnecting || !currentState.from) return

    const snap = this.snapAt(pointWorld)
    if (!snap || !snap.nodeId || !snap.anchor) {
      this.finish()
      return
    }

    if (currentState.reconnect) {
      const visibleEdges = this.instance.graph.read().visibleEdges
      const edge = visibleEdges.find((item) => item.id === currentState.reconnect?.edgeId)
      if (edge) {
        void this.instance.apply(
          [{
            type: 'edge.update',
            id: edge.id,
            patch:
              currentState.reconnect.end === 'source'
                ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
          }],
          { source: 'interaction' }
        )
      }
    } else {
      void this.instance.apply(
        [{
          type: 'edge.create',
          payload: {
            source: { nodeId: currentState.from.nodeId, anchor: currentState.from.anchor },
            target: { nodeId: snap.nodeId, anchor: snap.anchor },
            type: 'linear'
          }
        }],
        { source: 'interaction' }
      )
    }

    this.finish()
  }

  cancel: RuntimeInteraction['edgeConnect']['cancel'] = () => {
    this.finish()
    this.hoverCancel()
  }

  updateHover: RuntimeInteraction['edgeConnect']['updateHover'] = (pointWorld) => {
    const activeTool = this.instance.state.read('tool')
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

  hoverCancel: RuntimeInteraction['edgeConnect']['hoverCancel'] = () => {
    if (this.hoverRafId !== null) {
      cancelAnimationFrame(this.hoverRafId)
      this.hoverRafId = null
    }
    this.hoverPoint = null
  }

  hoverMove: RuntimeInteraction['edgeConnect']['hoverMove'] = (clientX, clientY, enabled) => {
    if (!enabled) {
      this.hoverCancel()
      return
    }

    this.hoverPoint = { x: clientX, y: clientY }
    if (this.hoverRafId === null) {
      this.hoverRafId = requestAnimationFrame(this.flushHover)
    }
  }

  handleNodePointerDown: RuntimeInteraction['edgeConnect']['handleNodePointerDown'] = (
    nodeId,
    pointWorld,
    pointerId
  ) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointWorld, pointerId)
    return true
  }
}
