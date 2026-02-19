import type { LifecycleContext } from '../../../context'
import {
  createPointerWindowHub,
  createSelectionBoxHandler,
  type PointerSessionBinding,
  type PointerSessionOnWindow
} from './pointerSession'
import { createInteractionHandlers } from './interactions'

type Options = {
  context: LifecycleContext
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

export class WindowBindings {
  private pointerHub: PointerSessionBinding

  constructor({ context, onWindow, getSelectionBox }: Options) {
    const interactionHandlers = createInteractionHandlers(context)

    this.pointerHub = createPointerWindowHub({
      onWindow,
      handlers: [
        ...interactionHandlers,
        createSelectionBoxHandler({
          getSelectionBox
        })
      ]
    })
  }

  start = () => {
    this.pointerHub.start()
  }

  sync = () => {
    this.pointerHub.sync()
  }

  stop = () => {
    this.pointerHub.stop()
  }
}
