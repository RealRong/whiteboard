import type { PointerSession } from '@engine-types/input'

export const createEdgeConnect = (): PointerSession => ({
  kind: 'edgeConnect',
  priority: 80,
  canStart: (event, context) => {
    const edgeConnect = context.state.read('edgeConnect')
    if (!edgeConnect.isConnecting) return false
    const pointerId = edgeConnect.pointerId
    if (pointerId === null || pointerId === undefined) return false
    return pointerId === event.pointerId
  },
  start: (event, context) => {
    const edgeConnect = context.state.read('edgeConnect')
    if (!edgeConnect.isConnecting) return null
    const pointerId = edgeConnect.pointerId
    if (pointerId === null || pointerId === undefined) return null
    if (pointerId !== event.pointerId) return null
    return {
      pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.edgeConnect.updateTo(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.edgeConnect.commitTo(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.runtime.interaction.edgeConnect.cancel()
      }
    }
  }
})
