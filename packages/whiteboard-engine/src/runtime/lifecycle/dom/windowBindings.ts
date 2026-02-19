import type { LifecycleContext } from '../../../context'
import { toPointerInput } from '../../../context'
import { createPointerIntentDispatcher } from '../input/pointer/intents'
import {
  createPointerWindowHub,
  createSelectionBoxHandler,
  type PointerSessionBinding,
  type PointerSessionHandler,
  type PointerSessionOnWindow
} from './pointerSession'
import { createInteractionSpecs } from './interactions'

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
    const dispatchIntent = createPointerIntentDispatcher(context)

    const interactionHandlers: PointerSessionHandler[] = createInteractionSpecs(
      context
    ).map((spec) => {
      const toMoveIntent = spec.toMoveIntent
      const toUpIntent = spec.toUpIntent
      const toCancelIntent = spec.toCancelIntent

      return {
        watch: spec.watch,
        getActive: spec.getActive,
        getPointerId: spec.getPointerId,
        onMove: toMoveIntent
          ? (event) => {
              const pointer = toPointerInput(context.runtime.viewport, event)
              dispatchIntent(toMoveIntent(pointer))
            }
          : undefined,
        onUp: toUpIntent
          ? (event) => {
              const pointer = toPointerInput(context.runtime.viewport, event)
              dispatchIntent(toUpIntent(pointer))
            }
          : undefined,
        onCancel: toCancelIntent
          ? (event) => {
              const pointer = toPointerInput(context.runtime.viewport, event)
              dispatchIntent(toCancelIntent(pointer))
            }
          : undefined
      }
    })

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
