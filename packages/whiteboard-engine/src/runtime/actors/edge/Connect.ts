import type { PointerInput } from '@engine-types/common'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Scheduler } from '../../contracts'
import { FrameTask } from '../../TaskQueue'
import type {
  CoreRegistries,
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  NodeId,
  Point
} from '@whiteboard/core/types'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'
import { type ConnectTo, isSameConnectTo } from './query'
import { buildEdgeCreateOperation } from './createOperation'
import type { SubmitMutations } from '../shared/MutationCommit'

type ConnectInstance = Pick<
  InternalInstance,
  'state' | 'projection' | 'query' | 'runtime'
>

type ConnectOptions = {
  instance: ConnectInstance
  registries: CoreRegistries
  scheduler: Scheduler
  submitMutations: SubmitMutations
}

export class Connect {
  private readonly instance: ConnectInstance
  private readonly registries: CoreRegistries
  private readonly submitMutations: SubmitMutations
  private readonly hoverTask: FrameTask
  private hoverPointer: PointerInput | null = null

  constructor({
    instance,
    registries,
    scheduler,
    submitMutations
  }: ConnectOptions) {
    this.instance = instance
    this.registries = registries
    this.submitMutations = submitMutations
    this.hoverTask = new FrameTask(scheduler, this.flushHover)
  }

  private flushHover = () => {
    const pointer = this.hoverPointer
    if (!pointer) return
    this.hoverPointer = null
    this.applyHover(pointer)
  }

  private createEdgeId = () => {
    const exists = (id: string) =>
      Boolean(this.instance.runtime.document.get().edges.some((edge) => edge.id === id))
    const seed = Date.now().toString(36)
    for (let index = 0; index < 1024; index += 1) {
      const id = `edge_${seed}_${index.toString(36)}`
      if (!exists(id)) return id
    }
    return `edge_${seed}_${Math.random().toString(36).slice(2, 8)}`
  }

  private buildEdgeCreateOperation = (payload: EdgeInput) => {
    const result = buildEdgeCreateOperation({
      payload,
      doc: this.instance.runtime.document.get(),
      registries: this.registries,
      createEdgeId: this.createEdgeId
    })
    if (!result.ok) return null
    return result.operation
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
    const visibleEdges = this.instance.projection.read().visibleEdges
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
    const from = currentState.from
    const reconnect = currentState.reconnect

    const snap = this.snapAt(pointWorld)
    if (!snap || !snap.nodeId || !snap.anchor) {
      this.finish()
      return
    }
    const targetNodeId = snap.nodeId
    const targetAnchor = snap.anchor

    if (reconnect) {
      const visibleEdges = this.instance.projection.read().visibleEdges
      const edge = visibleEdges.find(
        (item) => item.id === reconnect.edgeId
      )
      if (edge) {
        this.submitMutations(
          [
            {
              type: 'edge.update',
              id: edge.id,
              patch:
                reconnect.end === 'source'
                  ? { source: { nodeId: targetNodeId, anchor: targetAnchor } }
                  : { target: { nodeId: targetNodeId, anchor: targetAnchor } }
            }
          ],
          'interaction'
        )
      }
    } else {
      const createOperation = this.buildEdgeCreateOperation({
        source: {
          nodeId: from.nodeId,
          anchor: from.anchor
        },
        target: { nodeId: targetNodeId, anchor: targetAnchor },
        type: 'linear'
      })

      if (createOperation) {
        this.submitMutations(
          [createOperation],
          'interaction'
        )
      } else {
        this.finish()
        return
      }
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
    this.hoverTask.cancel()
    this.hoverPointer = null
  }

  hoverMove = (pointer: PointerInput | undefined, enabled: boolean) => {
    if (!enabled) {
      this.hoverCancel()
      return
    }
    if (!pointer) return

    this.hoverPointer = pointer
    this.hoverTask.schedule()
  }

  handleNodePointerDown = (nodeId: NodeId, pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return false
    this.startFromPoint(nodeId, pointer)
    return true
  }
}
