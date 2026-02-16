import type { Instance } from '@engine-types/instance'
import type { CanvasInput } from '../input'
import { createPointerSession } from './bindPointerSessionWindow'

type Options = {
  events: Instance['runtime']['events']
  getSelectionBox: () => CanvasInput['selectionBox']
}

export type SelectionBoxBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createSelectionBox = ({
  events,
  getSelectionBox
}: Options): SelectionBoxBinding =>
  createPointerSession({
    events,
    watch: (listener) => getSelectionBox().watchActive(listener),
    getActive: () => {
      const selectionBox = getSelectionBox()
      if (!selectionBox.isActive()) return undefined
      return {
        pointerId: selectionBox.getPointerId()
      }
    },
    getPointerId: (active) => active.pointerId,
    onPointerMove: (event) => {
      getSelectionBox().handlePointerMove(event)
    },
    onPointerUp: (event) => {
      getSelectionBox().handlePointerUp(event)
    },
    onPointerCancel: (event) => {
      getSelectionBox().handlePointerCancel(event)
    }
  })
