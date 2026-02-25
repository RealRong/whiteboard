import type { PointerSession } from '@engine-types/input'

export const createEdgeConnect = (): PointerSession => ({
  kind: 'edgeConnect',
  priority: 80,
  canStart: (event, context) => {
    const active = context.render.read('interactionSession').active
    if (active) {
      return active.kind === 'edgeConnect' && active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.target.role === 'node' && event.target.nodeId) {
      return context.state.read('tool') === 'edge'
    }
    if (event.target.role !== 'handle') return false
    if (event.target.handleType === 'node-connect') {
      return Boolean(event.target.nodeId && event.target.handleSide)
    }
    if (event.target.handleType === 'edge-endpoint') {
      return Boolean(event.target.edgeId && event.target.edgeEnd)
    }
    return false
  },
  start: (event, context) => {
    const active = context.render.read('interactionSession').active
    if (!active) {
      if (event.target.role === 'handle' && event.target.handleType === 'node-connect') {
        if (!event.target.nodeId || !event.target.handleSide) return null
        context.edgeInput.connect.startFromHandle(
          event.target.nodeId,
          event.target.handleSide,
          event.pointer
        )
      } else if (event.target.role === 'handle' && event.target.handleType === 'edge-endpoint') {
        if (!event.target.edgeId || !event.target.edgeEnd) return null
        context.edgeInput.connect.startReconnect(
          event.target.edgeId,
          event.target.edgeEnd,
          event.pointer
        )
      } else if (event.target.role === 'node' && event.target.nodeId) {
        const started = context.edgeInput.connect.handleNodePointerDown(
          event.target.nodeId,
          event.pointer
        )
        if (!started) return null
      } else {
        return null
      }
    } else {
      if (active.kind !== 'edgeConnect' || active.pointerId !== event.pointerId) return null
    }

    const session = context.render.read('interactionSession').active
    if (!session || session.kind !== 'edgeConnect' || session.pointerId !== event.pointerId) {
      return null
    }
    const current = context.render.read('edgeConnect')
    if (!current.from) return null
    return {
      pointerId: session.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.edgeInput.connect.updateConnect(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.edgeInput.connect.commitConnect(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.edgeInput.connect.cancelConnect()
      }
    }
  }
})
