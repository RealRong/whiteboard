import type { PointerSession } from '@engine-types/input'

export const createRoutingDrag = (): PointerSession => ({
  kind: 'routingDrag',
  priority: 70,
  canStart: (event, context) => {
    const active = context.state.read('routingDrag').active
    if (!active) return false
    return active.pointerId === event.pointerId
  },
  start: (event, context) => {
    const active = context.state.read('routingDrag').active
    if (!active) return null
    if (active.pointerId !== event.pointerId) return null
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.routingDrag.update({
          pointer: nextEvent.pointer
        })
      },
      end: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.routingDrag.end({
          pointer: nextEvent.pointer
        })
      },
      cancel: (_reason, nextContext) => {
        nextContext.runtime.interaction.routingDrag.cancel()
      }
    }
  }
})
