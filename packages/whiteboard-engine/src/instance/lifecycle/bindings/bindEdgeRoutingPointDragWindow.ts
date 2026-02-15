import type { WhiteboardInstance } from '@engine-types/instance'
import { createPointerSessionWindowBinding } from './bindPointerSessionWindow'

type Options = {
  state: WhiteboardInstance['state']
  events: WhiteboardInstance['runtime']['events']
  edgeCommands: Pick<
    WhiteboardInstance['commands']['edge'],
    'updateRoutingPointDrag' | 'endRoutingPointDrag' | 'cancelRoutingPointDrag'
  >
}

export type EdgeRoutingPointDragWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createEdgeRoutingPointDragWindowBinding = ({
  state,
  events,
  edgeCommands
}: Options): EdgeRoutingPointDragWindowBinding => {
  return createPointerSessionWindowBinding({
    events,
    watch: (listener) => state.watch('edgeRoutingPointDrag', listener),
    getActive: () => state.read('edgeRoutingPointDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      edgeCommands.updateRoutingPointDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (event) => {
      edgeCommands.endRoutingPointDrag({
        pointerId: event.pointerId
      })
    },
    onPointerCancel: (event) => {
      edgeCommands.cancelRoutingPointDrag({
        pointerId: event.pointerId
      })
    }
  })
}
