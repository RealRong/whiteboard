import type { PointerSession } from '@engine-types/input'

export const createEdgePath = (): PointerSession => ({
  kind: 'edgePath',
  priority: 75,
  canStart: (event) => {
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.modifiers.space) return false
    return event.target.role === 'edge' && Boolean(event.target.edgeId)
  },
  start: (event, context) => {
    const edgeId = event.target.edgeId
    if (!edgeId) return null

    const isInsertIntent = event.modifiers.shift || event.clickCount >= 2
    if (isInsertIntent) {
      context.actors.edge.insertRoutingPointAt(
        edgeId,
        event.pointer.world
      )
    }

    context.commands.edge.select(edgeId)

    return {
      pointerId: event.pointerId,
      update: () => {},
      end: () => {},
      cancel: () => {}
    }
  }
})
