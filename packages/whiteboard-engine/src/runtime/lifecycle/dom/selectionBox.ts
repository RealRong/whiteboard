import { createPointerSession, type PointerSessionOnWindow } from './pointerSession'

type Options = {
  onWindow: PointerSessionOnWindow
  getSelectionBox: () => SelectionBoxAccess
}

type SelectionBoxAccess = {
  watchActive: (listener: () => void) => () => void
  getPointerId: () => number | null
  handlePointerMove: (event: PointerEvent) => void
  handlePointerUp: (event: PointerEvent) => void
  handlePointerCancel: (event: PointerEvent) => void
}

export type SelectionBoxBinding = {
  start: () => void
  sync: () => void
  stop: () => void
}

export const createSelectionBox = ({
  onWindow,
  getSelectionBox
}: Options): SelectionBoxBinding =>
  createPointerSession({
    onWindow,
    watch: (listener) => getSelectionBox().watchActive(listener),
    getActive: () => {
      const selectionBox = getSelectionBox()
      const pointerId = selectionBox.getPointerId()
      if (pointerId === null) return undefined
      return {
        pointerId
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
