import type {
  PointerSession
} from '@engine-types/input'
import { DEFAULT_TUNING } from '../../config'

export const createNodeTransform = (): PointerSession => ({
  kind: 'nodeTransform',
  priority: 100,
  canStart: (event, context) => {
    const active = context.state.read('nodeTransform').active
    if (active) {
      return active.drag.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (context.state.read('tool') !== 'select') return false
    if (event.target.role !== 'handle' || event.target.handleType !== 'node-transform') return false
    return Boolean(event.target.nodeId)
  },
  start: (event, context) => {
    const active = context.state.read('nodeTransform').active
    if (active) {
      if (active.drag.pointerId !== event.pointerId) return null
    } else {
      const nodeId = event.target.nodeId
      if (!nodeId) return null
      const nodeRect = context.query.canvas.nodeRect(nodeId)
      if (!nodeRect) return null
      if (nodeRect.node.locked) return null

      let started = false
      if (event.target.transformKind === 'resize' && event.target.resizeDirection) {
        started = context.actors.node.startResize(
          nodeId,
          event.pointer,
          event.target.resizeDirection
        )
      }
      if (event.target.transformKind === 'rotate') {
        started = context.actors.node.startRotate(nodeId, event.pointer)
      }
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.actors.node.updateTransform(
          nextEvent.pointer,
          DEFAULT_TUNING.nodeTransform.minSize
        )
      },
      end: (nextEvent, nextContext) => {
        nextContext.actors.node.endTransform(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.actors.node.cancelTransform()
      }
    }
  }
})
