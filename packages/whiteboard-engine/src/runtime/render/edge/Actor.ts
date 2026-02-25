import type { Render } from '@engine-types/instance/render'
import type {
  RoutingDragPayload,
  RoutingDragState
} from '@engine-types/state'

type EdgeRender = Pick<Render, 'read' | 'write'>

export class Actor {
  private readonly render: EdgeRender

  constructor(render: EdgeRender) {
    this.render = render
  }

  getRouting = () => this.render.read('routingDrag').payload

  setRouting = (
    next: RoutingDragState | ((prev: RoutingDragState) => RoutingDragState)
  ) => {
    this.render.write('routingDrag', next)
  }

  setRoutingPayload = (payload: RoutingDragPayload | null) => {
    this.render.write('routingDrag', payload === null ? {} : { payload })
  }

  clearRouting = () => {
    this.render.write('routingDrag', {})
  }

  resetTransient = () => {
    this.render.write('routingDrag', {})
  }
}
