import type { PointerSession } from '@engine-types/input'

const isMiddleButtonDrag = (event: {
  button: number
  buttons: number
}) => event.button === 1 || (event.buttons & 4) === 4

const isSpaceLeftDrag = (event: {
  button: number
  buttons: number
  modifiers: { space: boolean }
}) => (event.button === 0 || (event.buttons & 1) === 1) && event.modifiers.space

const canPanByEvent = (event: {
  button: number
  buttons: number
  modifiers: { space: boolean }
}) => isMiddleButtonDrag(event) || isSpaceLeftDrag(event)

export const createViewportPan = (): PointerSession => ({
  kind: 'viewportPan',
  priority: 40,
  canStart: (event) => canPanByEvent(event),
  start: (event, context) => {
    if (!canPanByEvent(event)) return null
    const handled = context.services.viewportNavigation.startPan({
      pointer: event.pointer,
      enablePan: context.input.config.viewport.enablePan
    })
    if (!handled) return null
    const pointerId = event.pointerId
    return {
      pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.services.viewportNavigation.updatePan({
          pointer: nextEvent.pointer
        })
      },
      end: (_nextEvent, nextContext) => {
        nextContext.services.viewportNavigation.endPan({ pointerId })
      },
      cancel: (_reason, nextContext) => {
        nextContext.services.viewportNavigation.endPan({ pointerId })
      }
    }
  }
})
