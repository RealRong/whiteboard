import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { SchedulerRuntime } from '../../common/contracts'
import type { EdgeAnchor, EdgeId, NodeId, Point } from '@whiteboard/core'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'
import { type ConnectTo, isSameConnectTo } from './query'

type ConnectInstance = Pick<
  InternalInstance,
  'state' | 'graph' | 'query' | 'runtime' | 'apply'
>

type ConnectOptions = {
  instance: ConnectInstance
  raf: SchedulerRuntime['raf']
  cancelRaf: SchedulerRuntime['cancelRaf']
}

export class Connect {
  private readonly instance: ConnectInstance
  private readonly raf: SchedulerRuntime['raf']
  private readonly cancelRaf: SchedulerRuntime['cancelRaf']
  private hoverPointer: PointerInput | null = null
  private hoverRafId: number | null = null

  constructor({
    instance,
    raf,
    cancelRaf
  }: ConnectOptions) {
    this.instance = instance
    this.raf = raf
    this.cancelRaf = cancelRaf
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

      const { anchor, point: anchorPoint } = this.instance.query.geometry.anchorFromPoint(
        entry.rect,
        entry.rotation,
        point
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

  startFromHandle = (
    nodeId: NodeId,
    side: EdgeAnchor['side'],
    pointer: PointerInput
  ) => {
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

  startFromPoint = (nodeId: NodeId, pointer: PointerInput) => {
    const pointWorld = pointer.world
    const entry = this.instance.query.canvas.nodeRect(nodeId)
    if (!entry) return
    const { anchor } = this.instance.query.geometry.anchorFromPoint(
      entry.rect,
      entry.rotation,
      pointWorld
    )
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId, anchor },
      to: { pointWorld },
      hover: undefined,
      reconnect: undefined,
      pointerId: pointer.pointerId
    })
  }

  startReconnect = (
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: PointerInput
  ) => {
    const visibleEdges = this.instance.graph.read().visibleEdges
    const edge = visibleEdges.find((item) => item.id === edgeId)
    if (!edge) return
    const endpoint = edge[end]
    const anchor = endpoint.anchor ?? {
      side: 'right',
      offset: DEFAULT_TUNING.edge.anchorOffset
    }
    this.instance.state.write('edgeConnect', {
      isConnecting: true,
      from: { nodeId: endpoint.nodeId, anchor },
      to: undefined,
      hover: undefined,
      reconnect: { edgeId, end },
      pointerId: pointer.pointerId
    })
  }

  updateTo = (pointer: PointerInput) => {
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

  commitTo = (pointer: PointerInput) => {
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
      const edge = visibleEdges.find(
        (item) => item.id === currentState.reconnect?.edgeId
      )
      if (edge) {
        void this.instance.apply(
          [
            {
              type: 'edge.update',
              id: edge.id,
              patch:
                currentState.reconnect.end === 'source'
                  ? { source: { nodeId: snap.nodeId, anchor: snap.anchor } }
                  : { target: { nodeId: snap.nodeId, anchor: snap.anchor } }
            }
          ],
          { source: 'interaction' }
        )
      }
    } else {
      void this.instance.apply(
        [
          {
            type: 'edge.create',
            payload: {
              source: {
                nodeId: currentState.from.nodeId,
                anchor: currentState.from.anchor
              },
              target: { nodeId: snap.nodeId, anchor: snap.anchor },
              type: 'linear'
            }
          }
        ],
        { source: 'interaction' }
      )
    }

    this.finish()
  }

  cancel = () => {
    this.finish()
    this.hoverCancel()
  }

  private applyHover = (pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return
    const snap = this.snapAt(pointer.world)
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

  hoverCancel = () => {
    if (this.hoverRafId !== null) {
      this.cancelRaf(this.hoverRafId)
      this.hoverRafId = null
    }
    this.hoverPointer = null
  }

  hoverMove = (pointer: PointerInput | undefined, enabled: boolean) => {
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

  handleNodePointerDown = (nodeId: NodeId, pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointer)
    return true
  }
}
