import type { CanvasInputRuntime } from '../input/types'
import type { WhiteboardInstance } from '@engine-types/instance'
import { createPointerSessionWindowBinding } from './bindPointerSessionWindow'

type Options = {
  events: WhiteboardInstance['runtime']['events']
  getSelectionBox: () => CanvasInputRuntime['selectionBox']
}

export type SelectionBoxWindowBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createSelectionBoxWindowBinding = ({
  events,
  getSelectionBox
}: Options): SelectionBoxWindowBinding =>
  createPointerSessionWindowBinding({
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
