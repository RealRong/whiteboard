import type { PointerSession } from '@engine-types/input'

export const createNodeDrag = (): PointerSession => ({
  kind: 'nodeDrag',
  priority: 90,
  canStart: (event, context) => {
    const active = context.state.read('nodeDrag').active
    if (!active) return false
    return active.pointerId === event.pointerId
  },
  start: (event, context) => {
    const active = context.state.read('nodeDrag').active
    if (!active) return null
    if (active.pointerId !== event.pointerId) return null
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.nodeDrag.update({
          pointer: nextEvent.pointer
        })
      },
      end: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.nodeDrag.end({
          pointer: nextEvent.pointer
        })
      },
      cancel: (_reason, nextContext) => {
        nextContext.runtime.interaction.nodeDrag.cancel()
      }
    }
  }
})
