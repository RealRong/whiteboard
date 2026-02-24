import type {
  RoutingDragPayload,
  RoutingDragCancelOptions,
  RoutingDragEndOptions,
  RoutingDragStartOptions,
  RoutingDragUpdateOptions
} from '@engine-types/edge/routing'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeId, EdgeRouting, Point } from '@whiteboard/core/types'
import type { SubmitMutations } from '../../../runtime/actors/shared/MutationCommit'

type RoutingInstance = Pick<InternalInstance, 'state' | 'projection'>

type RoutingOptions = {
  instance: RoutingInstance
  submitMutations: SubmitMutations
}

export class Routing {
  private readonly instance: RoutingInstance
  private readonly submitMutations: SubmitMutations
  private session: RoutingDragPayload | null = null

  constructor({ instance, submitMutations }: RoutingOptions) {
    this.instance = instance
    this.submitMutations = submitMutations
  }

  private setInteractionSession = (pointerId?: number) => {
    this.instance.state.write('interactionSession', (prev) => {
      if (pointerId !== undefined) {
        if (
          prev.active?.kind === 'routingDrag'
          && prev.active.pointerId === pointerId
        ) {
          return prev
        }
        return {
          active: {
            kind: 'routingDrag',
            pointerId
          }
        }
      }
      if (prev.active?.kind !== 'routingDrag') return prev
      return {}
    })
  }

  private clear = () => {
    this.session = null
    this.instance.state.write('routingDrag', {})
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

  private selectEdge = (edgeId: EdgeId) => {
    this.instance.state.write('selection', (prev) => {
      if (prev.selectedEdgeId === edgeId) return prev
      return {
        ...prev,
        selectedEdgeId: edgeId
      }
    })
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
    state.batch(() => {
      this.session = payload
      state.write('routingDrag', {
        payload
      })
      this.setInteractionSession(pointer.pointerId)
      this.selectEdge(edgeId)
    })

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
    this.instance.state.batchFrame(() => {
      const payload: RoutingDragPayload = {
        ...active,
        point: nextPoint
      }
      this.session = payload
      this.instance.state.write('routingDrag', {
        payload
      })
    })

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
        this.submitMutations([operation], 'interaction')
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
