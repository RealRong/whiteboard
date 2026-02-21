import type { PointerSession } from '@engine-types/input'

export const createEdgeConnect = (): PointerSession => ({
  kind: 'edgeConnect',
  priority: 80,
  canStart: (event, context) => {
    const edgeConnect = context.state.read('edgeConnect')
    if (edgeConnect.isConnecting) {
      const pointerId = edgeConnect.pointerId
      if (pointerId === null || pointerId === undefined) return false
      return pointerId === event.pointerId
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
    const edgeConnect = context.state.read('edgeConnect')
    if (!edgeConnect.isConnecting) {
      if (event.target.role === 'handle' && event.target.handleType === 'node-connect') {
        if (!event.target.nodeId || !event.target.handleSide) return null
        context.actors.edge.startFromHandle(
          event.target.nodeId,
          event.target.handleSide,
          event.pointer
        )
      } else if (event.target.role === 'handle' && event.target.handleType === 'edge-endpoint') {
        if (!event.target.edgeId || !event.target.edgeEnd) return null
        context.actors.edge.startReconnect(
          event.target.edgeId,
          event.target.edgeEnd,
          event.pointer
        )
      } else if (event.target.role === 'node' && event.target.nodeId) {
        const started = context.actors.edge.handleNodePointerDown(
          event.target.nodeId,
          event.pointer
        )
        if (!started) return null
      } else {
        return null
      }
    } else {
      const pointerId = edgeConnect.pointerId
      if (pointerId === null || pointerId === undefined) return null
      if (pointerId !== event.pointerId) return null
    }

    const current = context.state.read('edgeConnect')
    const pointerId = current.pointerId
    if (!current.isConnecting || pointerId === null || pointerId === undefined) return null
    return {
      pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.actors.edge.updateConnect(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.actors.edge.commitConnect(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.actors.edge.cancelConnect()
      }
    }
  }
})
