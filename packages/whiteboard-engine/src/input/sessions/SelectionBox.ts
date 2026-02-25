import type { PointerSession } from '@engine-types/input'

export const createSelectionBox = (): PointerSession => ({
  kind: 'selectionBox',
  priority: 50,
  canStart: (event, context) => {
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.modifiers.space) return false
    if (context.state.read('tool') === 'edge') return false
    return event.target.role === 'background'
  },
  start: (event, context) => {
    const pointerId = event.pointerId
    const started = context.selectionInput.box.start({
      pointerId,
      screen: event.pointer.screen,
      world: event.pointer.world,
      modifiers: event.modifiers
    })
    if (!started) return null
    return {
      pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.selectionInput.box.update({
          pointerId: nextEvent.pointerId,
          screen: nextEvent.pointer.screen,
          world: nextEvent.pointer.world
        })
      },
      end: (nextEvent, nextContext) => {
        nextContext.selectionInput.box.end(nextEvent.pointerId)
      },
      cancel: (_reason, nextContext) => {
        nextContext.selectionInput.box.cancel(pointerId)
      }
    }
  }
})
