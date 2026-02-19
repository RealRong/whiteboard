import type { Instance } from '@engine-types/instance/instance'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'

type RoutingDragApi = RuntimeInteraction['routingDrag']

export class RoutingDrag implements RoutingDragApi {
  private readonly instance: Instance

  constructor(instance: Instance) {
    this.instance = instance
  }

  private clear = () => {
    this.instance.state.write('routingDrag', {})
  }

  start: RoutingDragApi['start'] = ({ edgeId, index, pointerId, clientX, clientY }) => {
    const { state, graph, runtime, commands } = this.instance
    if (state.read('routingDrag').active) return false
    const edge = graph.read().visibleEdges.find((item) => item.id === edgeId)
    if (!edge || edge.type === 'bezier' || edge.type === 'curve') return false

    const points = edge.routing?.points ?? []
    if (index < 0 || index >= points.length) return false

    const start = runtime.viewport.clientToWorld(clientX, clientY)
    state.batch(() => {
      state.write('routingDrag', {
        active: {
          edgeId,
          index,
          pointerId,
          start,
          origin: points[index]
        }
      })
      commands.edge.select(edgeId)
    })
    return true
  }

  update: RoutingDragApi['update'] = ({ pointerId, clientX, clientY }) => {
    const { state, graph, runtime, commands } = this.instance
    const active = state.read('routingDrag').active
    if (!active || active.pointerId !== pointerId) return false

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

    const current = runtime.viewport.clientToWorld(clientX, clientY)
    const nextPoint = {
      x: active.origin.x + (current.x - active.start.x),
      y: active.origin.y + (current.y - active.start.y)
    }
    commands.edge.moveRoutingPoint(edge, active.index, nextPoint)
    return true
  }

  end: RoutingDragApi['end'] = ({ pointerId }) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active || active.pointerId !== pointerId) return false
    this.clear()
    return true
  }

  cancel: RoutingDragApi['cancel'] = (options) => {
    const active = this.instance.state.read('routingDrag').active
    if (!active) return false
    if (typeof options?.pointerId === 'number' && active.pointerId !== options.pointerId) return false
    this.clear()
    return true
  }
}
