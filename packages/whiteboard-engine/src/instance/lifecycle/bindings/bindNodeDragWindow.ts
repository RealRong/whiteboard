import type { WhiteboardInstance } from '@engine-types/instance'
import { createPointerSessionWindowBinding } from './bindPointerSessionWindow'

type Options = {
  state: WhiteboardInstance['state']
  events: WhiteboardInstance['runtime']['events']
  nodeDragCommands: Pick<
    WhiteboardInstance['commands']['nodeDrag'],
    'update' | 'end' | 'cancel'
  >
}

export type NodeDragWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createNodeDragWindowBinding = ({
  state,
  events,
  nodeDragCommands
}: Options): NodeDragWindowBinding =>
  createPointerSessionWindowBinding({
    events,
    watch: (listener) => state.watch('nodeDrag', listener),
    getActive: () => state.read('nodeDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      nodeDragCommands.update({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        altKey: event.altKey
      })
    },
    onPointerUp: (event) => {
      nodeDragCommands.end({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      nodeDragCommands.cancel({ pointerId: event.pointerId })
    }
  })
