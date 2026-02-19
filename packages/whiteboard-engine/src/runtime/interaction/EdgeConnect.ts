import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import type { PointerInput } from '@engine-types/common'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import type { InteractionContext } from '../../context'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../config'
import { type ConnectTo, isSameConnectTo } from '../../kernel/query'

type EdgeConnectInteraction = RuntimeInteraction['edgeConnect']

export class EdgeConnect implements EdgeConnectInteraction {
  private readonly instance: InteractionContext['instance']
  private readonly raf: InteractionContext['schedulers']['raf']
  private readonly cancelRaf: InteractionContext['schedulers']['cancelRaf']
  private hoverPointer: PointerInput | null = null
  private hoverRafId: number | null = null

  constructor(context: InteractionContext) {
    this.instance = context.instance
    this.raf = context.schedulers.raf
    this.cancelRaf = context.schedulers.cancelRaf
  }

  private flushHover = () => {
    this.hoverRafId = null
    const pointer = this.hoverPointer
    if (!pointer) return
    this.hoverPointer = null
    this.applyHover(pointer)
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

  startFromHandle: RuntimeInteraction['edgeConnect']['startFromHandle'] = (nodeId, side, pointer) => {
    const anchor: EdgeAnchor = { side, offset: DEFAULT_TUNING.edge.anchorOffset }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: undefined,
      pointerId: pointer.pointerId
    })
  }

  startFromPoint: RuntimeInteraction['edgeConnect']['startFromPoint'] = (nodeId, pointer) => {
    const pointWorld = pointer.world
    const entry = this.instance.query.canvas.nodeRect(nodeId)
    if (!entry) return
    const { anchor } = this.instance.query.geometry.anchorFromPoint(entry.rect, entry.rotation, pointWorld)
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointer.pointerId
    })
  }

  startReconnect: RuntimeInteraction['edgeConnect']['startReconnect'] = (edgeId: EdgeId, end, pointer) => {
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
      pointerId: pointer.pointerId
    })
  }

  updateTo: RuntimeInteraction['edgeConnect']['updateTo'] = (pointer) => {
    const pointWorld = pointer.world
    this.instance.state.write('edgeConnect', (prev) => {
      if (!prev.isConnecting || !prev.from) return prev
      const snap = this.snapAt(pointWorld)
      if (snap) {
        return { ...prev, to: snap }
      }
      return { ...prev, to: { pointWorld } }
    })
  }

  commitTo: RuntimeInteraction['edgeConnect']['commitTo'] = (pointer) => {
    const pointWorld = pointer.world
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

  private applyHover = (pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return
    const pointWorld = pointer.world
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
      this.cancelRaf(this.hoverRafId)
      this.hoverRafId = null
    }
    this.hoverPointer = null
  }

  hoverMove: RuntimeInteraction['edgeConnect']['hoverMove'] = (pointer, enabled) => {
    if (!enabled) {
      this.hoverCancel()
      return
    }
    if (!pointer) return

    this.hoverPointer = pointer
    if (this.hoverRafId === null) {
      this.hoverRafId = this.raf(this.flushHover)
    }
  }

  handleNodePointerDown: RuntimeInteraction['edgeConnect']['handleNodePointerDown'] = (
    nodeId,
    pointer
  ) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointer)
    return true
  }
}
