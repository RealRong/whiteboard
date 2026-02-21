import type {
  RoutingDragCancelOptions,
  RoutingDragEndOptions,
  RoutingDragStartOptions,
  RoutingDragUpdateOptions
} from '@engine-types/edge/routing'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeId, EdgeRouting, Point } from '@whiteboard/core'

type RoutingInstance = Pick<InternalInstance, 'state' | 'graph' | 'apply'>

type RoutingOptions = {
  instance: RoutingInstance
}

export class Routing {
  private readonly instance: RoutingInstance

  constructor({ instance }: RoutingOptions) {
    this.instance = instance
  }

  private clear = () => {
    this.instance.state.write('routingDrag', {})
  }

  private selectEdge = (edgeId: EdgeId) => {
    this.instance.state.write('edgeSelection', (prev) =>
      prev === edgeId ? prev : edgeId
    )
  }

  private moveRoutingPoint = (
    edgeId: EdgeId,
    routing: EdgeRouting | undefined,
    points: Point[],
    index: number,
    pointWorld: Point
  ) => {
    if (index < 0 || index >= points.length) return
    const nextPoints = points.map((point, idx) =>
      idx === index ? pointWorld : point
    )
    void this.instance.apply(
      [
        {
          type: 'edge.update',
          id: edgeId,
          patch: {
            routing: {
              ...(routing ?? {}),
              mode: routing?.mode ?? 'manual',
              points: nextPoints
            }
          }
        }
      ],
      { source: 'interaction' }
    )
  }

  start = ({ edgeId, index, pointer }: RoutingDragStartOptions) => {
    const { state, graph } = this.instance
    if (state.read('routingDrag').active) return false

    const edge = graph.read().visibleEdges.find((item) => item.id === edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return false

    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const start = pointer.world
    state.batch(() => {
      state.write('routingDrag', {
        active: {
          edgeId,
          index,
          pointerId: pointer.pointerId,
          start,
          origin: points[index]
        }
      })
      this.selectEdge(edgeId)
    })

    return true
  }

  update = ({ pointer }: RoutingDragUpdateOptions) => {
    const { state, graph } = this.instance
    const active = state.read('routingDrag').active
    if (!active || active.pointerId !== pointer.pointerId) return false

    const edge = graph.read().visibleEdges.find((item) => item.id === active.edgeId)
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
    this.moveRoutingPoint(
      edge.id,
      edge.routing,
      points,
      active.index,
      nextPoint
    )

    return true
  }

  end = ({ pointer }: RoutingDragEndOptions) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active || active.pointerId !== pointer.pointerId) return false
    this.clear()
    return true
  }

  cancel = (options?: RoutingDragCancelOptions) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active) return false
    if (options?.pointer && active.pointerId !== options.pointer.pointerId) return false
    this.clear()
    return true
  }
}
