import type { PointerSession } from '@engine-types/input'

export const createMindmapDrag = (): PointerSession => ({
  kind: 'mindmapDrag',
  priority: 60,
  canStart: (event, context) => {
    const active = context.state.read('mindmapDrag').active
    if (!active) return false
    return active.pointerId === event.pointerId
  },
  start: (event, context) => {
    const active = context.state.read('mindmapDrag').active
    if (!active) return null
    if (active.pointerId !== event.pointerId) return null
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.mindmapDrag.update({
          pointer: nextEvent.pointer
        })
      },
      end: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.mindmapDrag.end({
          pointer: nextEvent.pointer
        })
      },
      cancel: (_reason, nextContext) => {
        nextContext.runtime.interaction.mindmapDrag.cancel()
      }
    }
  }
})
