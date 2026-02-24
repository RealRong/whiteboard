import type { PointerSession } from '@engine-types/input'

export const createRoutingDrag = (): PointerSession => ({
  kind: 'routingDrag',
  priority: 70,
  canStart: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      return active.kind === 'routingDrag' && active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    return (
      event.target.role === 'handle'
      && event.target.handleType === 'edge-routing'
      && Boolean(event.target.edgeId)
      && Number.isInteger(event.target.routingIndex)
    )
  },
  start: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      if (active.kind !== 'routingDrag' || active.pointerId !== event.pointerId) return null
    } else {
      if (!event.target.edgeId || !Number.isInteger(event.target.routingIndex)) return null
      if (event.clickCount >= 2) {
        context.edgeInput.routing.removeRoutingPointAt(
          event.target.edgeId,
          event.target.routingIndex as number
        )
        return null
      }
      const started = context.edgeInput.routing.startRouting(
        event.target.edgeId,
        event.target.routingIndex as number,
        event.pointer
      )
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.edgeInput.routing.updateRouting(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.edgeInput.routing.endRouting(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.edgeInput.routing.cancelRouting()
      }
    }
  }
})
