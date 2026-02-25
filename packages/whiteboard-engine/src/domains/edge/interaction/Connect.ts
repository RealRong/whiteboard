import type { PointerInput } from '@engine-types/common'
import type { EdgeConnectState } from '@engine-types/state'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { Scheduler } from '../../../runtime/Scheduler'
import { FrameTask } from '../../../runtime/TaskQueue'
import type {
  EdgeAnchor,
  EdgeId,
  EdgeInput,
  NodeId,
  Operation,
  Point
} from '@whiteboard/core/types'
import { DEFAULT_INTERNALS, DEFAULT_TUNING } from '../../../config'
import { type ConnectTo, isSameConnectTo } from '../query'
import { buildEdgeCreateOperation } from '../commands/createOperation'
import type { RuntimeOutput } from './RuntimeOutput'

type ConnectInstance = Pick<
  InternalInstance,
  'state' | 'render' | 'projection' | 'query' | 'document' | 'registries' | 'config' | 'viewport'
>

type ConnectOptions = {
  instance: ConnectInstance
  scheduler: Scheduler
  emit: (output: RuntimeOutput) => void
}

type CommitTarget = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

export class Connect {
  private readonly instance: ConnectInstance
  private readonly emit: (output: RuntimeOutput) => void
  private readonly hoverTask: FrameTask
  private hoverPointer: PointerInput | null = null

  constructor({
    instance,
    scheduler,
    emit
  }: ConnectOptions) {
    this.instance = instance
    this.emit = emit
    this.hoverTask = new FrameTask(scheduler, this.flushHover)
  }

  private setInteractionSession = (pointerId?: number) => {
    this.emit({
      interaction: {
        kind: 'edgeConnect',
        pointerId: pointerId ?? null
      }
    })
  }

  private flushHover = () => {
    const pointer = this.hoverPointer
    if (!pointer) return
    this.hoverPointer = null
    this.applyHover(pointer)
  }

  private createEdgeId = () => {
    const exists = (id: string) =>
      Boolean(this.instance.document.get().edges.some((edge) => edge.id === id))
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
      doc: this.instance.document.get(),
      registries: this.instance.registries,
      createEdgeId: this.createEdgeId
    })
    if (!result.ok) return null
    return result.operation
  }

  private snapAt = (point: Point): ConnectTo | undefined => {
    const { config, viewport } = this.instance
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
    this.emit({
      edgeConnect: (prev) => ({
        ...prev,
        from: undefined,
        to: undefined,
        reconnect: undefined
      })
    })
    this.setInteractionSession(undefined)
  }

  private resolveCommitTarget = (
    currentState: EdgeConnectState,
    pointWorld?: Point
  ): CommitTarget | undefined => {
    const snap =
      (pointWorld ? this.snapAt(pointWorld) : undefined)
      ?? (
        currentState.to?.nodeId && currentState.to.anchor
          ? {
            nodeId: currentState.to.nodeId,
            anchor: currentState.to.anchor
          }
          : undefined
      )
    if (!snap?.nodeId || !snap.anchor) return undefined
    return {
      nodeId: snap.nodeId,
      anchor: snap.anchor
    }
  }

  private resolveCommitMutations = (options: {
    from: NonNullable<EdgeConnectState['from']>
    reconnect: EdgeConnectState['reconnect']
    target: CommitTarget
  }): Operation[] | null => {
    const { from, reconnect, target } = options
    if (reconnect) {
      const visibleEdges = this.instance.projection.getSnapshot().edges.visible
      const edge = visibleEdges.find((item) => item.id === reconnect.edgeId)
      if (!edge) return []
      return [
        {
          type: 'edge.update',
          id: edge.id,
          patch:
            reconnect.end === 'source'
              ? { source: { nodeId: target.nodeId, anchor: target.anchor } }
              : { target: { nodeId: target.nodeId, anchor: target.anchor } }
        }
      ]
    }

    const createOperation = this.buildEdgeCreateOperation({
      source: {
        nodeId: from.nodeId,
        anchor: from.anchor
      },
      target: {
        nodeId: target.nodeId,
        anchor: target.anchor
      },
      type: 'linear'
    })
    if (!createOperation) return null
    return [createOperation]
  }

  beginFromHandle = (
    nodeId: NodeId,
    side: EdgeAnchor['side'],
    pointer: PointerInput
  ) => {
    const anchor: EdgeAnchor = { side, offset: DEFAULT_TUNING.edge.anchorOffset }
    this.emit({
      edgeConnect: {
        from: { nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: undefined
      }
    })
    this.setInteractionSession(pointer.pointerId)
  }

  beginFromNode = (nodeId: NodeId, pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return
    const pointWorld = pointer.world
    const entry = this.instance.query.canvas.nodeRect(nodeId)
    if (!entry) return
    const { anchor } = this.instance.query.geometry.anchorFromPoint(
      entry.rect,
      entry.rotation,
      pointWorld
    )
    this.emit({
      edgeConnect: {
        from: { nodeId, anchor },
        to: { pointWorld },
        hover: undefined,
        reconnect: undefined
      }
    })
    this.setInteractionSession(pointer.pointerId)
  }

  beginReconnect = (
    edgeId: EdgeId,
    end: 'source' | 'target',
    pointer: PointerInput
  ) => {
    const visibleEdges = this.instance.projection.getSnapshot().edges.visible
    const edge = visibleEdges.find((item) => item.id === edgeId)
    if (!edge) return
    const endpoint = edge[end]
    const anchor = endpoint.anchor ?? {
      side: 'right',
      offset: DEFAULT_TUNING.edge.anchorOffset
    }
    this.emit({
      edgeConnect: {
        from: { nodeId: endpoint.nodeId, anchor },
        to: undefined,
        hover: undefined,
        reconnect: { edgeId, end }
      }
    })
    this.setInteractionSession(pointer.pointerId)
  }

  updateDraft = (pointer: PointerInput) => {
    const active = this.instance.render.read('interactionSession').active
    if (active?.kind !== 'edgeConnect' || active.pointerId !== pointer.pointerId) return
    const pointWorld = pointer.world
    this.emit({
      edgeConnect: (prev) => {
        if (!prev.from) return prev
        const snap = this.snapAt(pointWorld)
        if (snap) {
          return { ...prev, to: snap }
        }
        return { ...prev, to: { pointWorld } }
      }
    })
  }

  commitDraft = (pointer?: PointerInput) => {
    const active = this.instance.render.read('interactionSession').active
    if (active?.kind !== 'edgeConnect') return
    if (pointer && active.pointerId !== pointer.pointerId) return
    const pointWorld = pointer?.world
    const currentState = this.instance.render.read('edgeConnect')
    if (!currentState.from) return
    const target = this.resolveCommitTarget(currentState, pointWorld)
    if (!target) {
      this.finish()
      return
    }

    const mutations = this.resolveCommitMutations({
      from: currentState.from,
      reconnect: currentState.reconnect,
      target
    })
    if (mutations === null) {
      this.finish()
      return
    }
    if (mutations.length > 0) {
      this.emit({
        mutations
      })
    }

    this.finish()
  }

  cancelDraft = () => {
    this.finish()
    this.hoverCancel()
  }

  private applyHover = (pointer: PointerInput) => {
    const activeTool = this.instance.state.read('tool')
    if (activeTool !== 'edge') return
    const active = this.instance.render.read('interactionSession').active
    if (active?.kind === 'edgeConnect') return
    const snap = this.snapAt(pointer.world)
    this.emit({
      edgeConnect: (prev) => {
        if (!snap) {
          if (!prev.hover) return prev
          return { ...prev, hover: undefined }
        }
        if (isSameConnectTo(prev.hover, snap)) return prev
        return { ...prev, hover: snap }
      }
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

}
