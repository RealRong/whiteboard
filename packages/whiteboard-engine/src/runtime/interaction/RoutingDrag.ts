import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import type { InteractionContext } from '../../context'

type RoutingDragApi = RuntimeInteraction['routingDrag']

export class RoutingDrag implements RoutingDragApi {
  private readonly instance: InteractionContext['instance']

  constructor(context: InteractionContext) {
    this.instance = context.instance
  }

  private clear = () => {
    this.instance.state.write('routingDrag', {})
  }

  start: RoutingDragApi['start'] = ({ edgeId, index, pointer }) => {
    const { state, graph, runtime, commands } = this.instance
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
      commands.edge.select(edgeId)
    })
    return true
  }

  update: RoutingDragApi['update'] = ({ pointer }) => {
    const { state, graph, runtime, commands } = this.instance
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
    commands.edge.moveRoutingPoint(edge, active.index, nextPoint)
    return true
  }

  end: RoutingDragApi['end'] = ({ pointer }) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active || active.pointerId !== pointer.pointerId) return false
    this.clear()
    return true
  }

  cancel: RoutingDragApi['cancel'] = (options) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active) return false
    if (options?.pointer && active.pointerId !== options.pointer.pointerId) return false
    this.clear()
    return true
  }
}
