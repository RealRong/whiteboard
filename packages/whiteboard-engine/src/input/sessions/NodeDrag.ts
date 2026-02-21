import type { PointerSession } from '@engine-types/input'
import { resolveSelectionMode } from '../shared/selection'

export const createNodeDrag = (): PointerSession => ({
  kind: 'nodeDrag',
  priority: 90,
  canStart: (event, context) => {
    const active = context.state.read('nodeDrag').active
    if (active) {
      return active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (event.modifiers.space) return false
    if (context.state.read('tool') === 'edge') return false
    return event.target.role === 'node' && Boolean(event.target.nodeId)
  },
  start: (event, context) => {
    const active = context.state.read('nodeDrag').active
    if (active) {
      if (active.pointerId !== event.pointerId) return null
    } else {
      const nodeId = event.target.nodeId
      if (!nodeId) return null
      const nodeRect = context.query.canvas.nodeRect(nodeId)
      if (!nodeRect || nodeRect.node.locked) return null

      const mode = resolveSelectionMode(event.modifiers)
      if (mode === 'toggle') {
        context.commands.selection.toggle([nodeId])
      } else {
        context.commands.selection.select([nodeId], mode)
      }

      const started = context.actors.node.startDrag(nodeId, event.pointer)
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.actors.node.updateDrag(nextEvent.pointer)
      },
      end: (nextEvent, nextContext) => {
        nextContext.actors.node.endDrag(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.actors.node.cancelDrag()
      }
    }
  }
})
