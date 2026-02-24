import type { PointerSession } from '@engine-types/input'

export const createNodeDrag = (): PointerSession => ({
  kind: 'nodeDrag',
  priority: 90,
  canStart: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      return active.kind === 'nodeDrag' && active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.modifiers.space) return false
    if (context.state.read('tool') === 'edge') return false
    return event.target.role === 'node' && Boolean(event.target.nodeId)
  },
  start: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      if (active.kind !== 'nodeDrag' || active.pointerId !== event.pointerId) return null
    } else {
      const nodeId = event.target.nodeId
      if (!nodeId) return null
      const nodeRect = context.query.canvas.nodeRect(nodeId)
      if (!nodeRect || nodeRect.node.locked) return null

      const started = context.nodeInput.drag.start({
        nodeId,
        pointer: event.pointer,
        modifiers: event.modifiers
      })
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.nodeInput.drag.update(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.nodeInput.drag.end(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.nodeInput.drag.cancel()
      }
    }
  }
})
