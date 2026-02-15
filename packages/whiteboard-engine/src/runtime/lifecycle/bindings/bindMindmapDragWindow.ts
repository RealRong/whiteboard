import type { Instance } from '@engine-types/instance'
import { createPointerSessionWindowBinding } from './bindPointerSessionWindow'

type Options = {
  state: Instance['state']
  events: Instance['runtime']['events']
  mindmapCommands: Pick<
    Instance['commands']['mindmap'],
    'updateDrag' | 'endDrag' | 'cancelDrag'
  >
}

export type MindmapDragWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createMindmapDragWindowBinding = ({
  state,
  events,
  mindmapCommands
}: Options): MindmapDragWindowBinding =>
  createPointerSessionWindowBinding({
    events,
    watch: (listener) => state.watch('mindmapDrag', listener),
    getActive: () => state.read('mindmapDrag').active,
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      mindmapCommands.updateDrag({
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY
      })
    },
    onPointerUp: (event) => {
      mindmapCommands.endDrag({ pointerId: event.pointerId })
    },
    onPointerCancel: (event) => {
      mindmapCommands.cancelDrag({ pointerId: event.pointerId })
    }
  })
