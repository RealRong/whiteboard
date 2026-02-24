import type { PointerSession } from '@engine-types/input'

export const createMindmapDrag = (): PointerSession => ({
  kind: 'mindmapDrag',
  priority: 60,
  canStart: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      return active.kind === 'mindmapDrag' && active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    return (
      event.target.role === 'handle'
      && event.target.handleType === 'mindmap-node'
      && Boolean(event.target.treeId)
      && Boolean(event.target.nodeId)
    )
  },
  start: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      if (active.kind !== 'mindmapDrag' || active.pointerId !== event.pointerId) return null
    } else {
      if (!event.target.treeId || !event.target.nodeId) return null
      const started = context.mindmapInput.drag.start(
        event.target.treeId,
        event.target.nodeId,
        event.pointer
      )
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.mindmapInput.drag.update(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.mindmapInput.drag.end(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.mindmapInput.drag.cancel()
      }
    }
  }
})
