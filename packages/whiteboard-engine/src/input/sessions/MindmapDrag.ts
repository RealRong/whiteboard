import type { PointerSession } from '@engine-types/input'

export const createMindmapDrag = (): PointerSession => ({
  kind: 'mindmapDrag',
  priority: 60,
  canStart: (event, context) => {
    const active = context.state.read('mindmapDrag').active
    if (active) {
      return active.pointerId === event.pointerId
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
    const active = context.state.read('mindmapDrag').active
    if (active) {
      if (active.pointerId !== event.pointerId) return null
    } else {
      if (!event.target.treeId || !event.target.nodeId) return null
      const started = context.actors.mindmap.startDrag(
        event.target.treeId,
        event.target.nodeId,
        event.pointer
      )
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.actors.mindmap.updateDrag(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.actors.mindmap.endDrag(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.actors.mindmap.cancelDrag()
      }
    }
  }
})
