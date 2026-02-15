import type { Instance } from '@engine-types/instance'
import { createPointerSession } from './bindPointerSessionWindow'

type Options = {
  state: Instance['state']
  events: Instance['runtime']['events']
  edgeCommands: Pick<
    Instance['commands']['edge'],
    'updateRoutingDrag' | 'endRoutingDrag' | 'cancelRoutingDrag'
  >
}

export type RoutingDragBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createRoutingDrag = ({
  state,
  events,
  edgeCommands
}: Options): RoutingDragBinding => {
  return createPointerSession({
    events,
    watch: (listener) => state.watch('routingDrag', listener),
    getActive: () => state.read('routingDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      edgeCommands.updateRoutingDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (event) => {
      edgeCommands.endRoutingDrag({
        pointerId: event.pointerId
      })
    },
    onPointerCancel: (event) => {
      edgeCommands.cancelRoutingDrag({
        pointerId: event.pointerId
      })
    }
  })
}
