import type {
  RoutingDragPayload,
  RoutingDragCancelOptions,
  RoutingDragEndOptions,
  RoutingDragStartOptions,
  RoutingDragUpdateOptions
} from '@engine-types/edge/routing'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeId, EdgeRouting, Point } from '@whiteboard/core/types'
import type { RuntimeOutput } from './RuntimeOutput'

type RoutingInstance = Pick<InternalInstance, 'state' | 'projection'>

type RoutingOptions = {
  instance: RoutingInstance
  emit: (output: RuntimeOutput) => void
}

export class Routing {
  private readonly instance: RoutingInstance
  private readonly emit: (output: RuntimeOutput) => void
  private session: RoutingDragPayload | null = null

  constructor({ instance, emit }: RoutingOptions) {
    this.instance = instance
    this.emit = emit
  }

  private setInteractionSession = (pointerId?: number) => {
    this.emit({
      interaction: {
        kind: 'routingDrag',
        pointerId: pointerId ?? null
      }
    })
  }

  private clear = () => {
    this.session = null
    this.emit({
      routingDrag: {}
    })
    this.setInteractionSession(undefined)
  }

  private readActive = (pointerId?: number) => {
    const session = this.instance.state.read('interactionSession').active
    if (!session || session.kind !== 'routingDrag') return undefined
    if (pointerId !== undefined && session.pointerId !== pointerId) return undefined

    const active = this.session
    if (!active) return undefined
    if (active.pointerId !== session.pointerId) return undefined
    return active
  }

  getPayload = () => this.readActive()

  reset = () => {
    this.clear()
  }

  private moveRoutingPoint = (
    edgeId: EdgeId,
    routing: EdgeRouting | undefined,
    points: Point[],
    index: number,
    pointWorld: Point
  ) => {
    if (index < 0 || index >= points.length) return
    const current = points[index]
    if (current.x === pointWorld.x && current.y === pointWorld.y) return
    const nextPoints = points.map((point, idx) =>
      idx === index ? pointWorld : point
    )
    return {
      type: 'edge.update' as const,
      id: edgeId,
      patch: {
        routing: {
          ...(routing ?? {}),
          mode: routing?.mode ?? 'manual',
          points: nextPoints
        }
      }
    }
  }

  start = ({ edgeId, index, pointer }: RoutingDragStartOptions) => {
    const { state, projection } = this.instance
    if (state.read('interactionSession').active) return false

    const edge = projection.getSnapshot().edges.visible.find((item) => item.id === edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return false

    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const start = pointer.world
    const payload: RoutingDragPayload = {
      edgeId,
      index,
      pointerId: pointer.pointerId,
      start,
      origin: points[index],
      point: points[index]
    }
    this.emit({
      routingDrag: {
        payload
      },
      interaction: {
        kind: 'routingDrag',
        pointerId: pointer.pointerId
      },
      selection: (prev) => {
        if (prev.selectedEdgeId === edgeId) return prev
        return {
          ...prev,
          selectedEdgeId: edgeId
        }
      }
    })
    this.session = payload

    return true
  }

  update = ({ pointer }: RoutingDragUpdateOptions) => {
    const { projection } = this.instance
    const active = this.readActive(pointer.pointerId)
    if (!active) return false

    const edge = projection.getSnapshot().edges.visible.find((item) => item.id === active.edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') {
      this.clear()
      return false
    }

    const points = edge.routing?.points ?? []
    if (active.index < 0 || active.index >= points.length) {
      this.clear()
      return false
    }

    const current = pointer.world
    const nextPoint = {
      x: active.origin.x + (current.x - active.start.x),
      y: active.origin.y + (current.y - active.start.y)
    }
    const payload: RoutingDragPayload = {
      ...active,
      point: nextPoint
    }
    this.emit({
      frame: true,
      routingDrag: {
        payload
      }
    })
    this.session = payload

    return true
  }

  end = ({ pointer }: RoutingDragEndOptions) => {
    const active = this.readActive(pointer.pointerId)
    if (!active) return false
    const edge = this.instance.projection
      .getSnapshot()
      .edges.visible
      .find((item) => item.id === active.edgeId)
    if (edge && edge.type !== 'bezier' && edge.type !== 'curve') {
      const points = edge.routing?.points ?? []
      const operation = this.moveRoutingPoint(
        edge.id,
        edge.routing,
        points,
        active.index,
        active.point
      )
      if (operation) {
        this.emit({
          mutations: [operation]
        })
      }
    }
    this.clear()
    return true
  }

  cancel = (options?: RoutingDragCancelOptions) => {
    const active = this.readActive(options?.pointer?.pointerId)
    if (!active) return false
    if (options?.pointer && active.pointerId !== options.pointer.pointerId) return false
    this.clear()
    return true
  }
}
