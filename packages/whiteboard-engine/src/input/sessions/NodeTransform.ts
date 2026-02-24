import type {
  PointerSession
} from '@engine-types/input'
import { DEFAULT_TUNING } from '../../config'

export const createNodeTransform = (): PointerSession => ({
  kind: 'nodeTransform',
  priority: 100,
  canStart: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      return active.kind === 'nodeTransform' && active.pointerId === event.pointerId
    }
    if (event.phase !== 'down') return false
    if (event.source !== 'container') return false
    if (event.button !== 0) return false
    if (context.state.read('tool') !== 'select') return false
    if (event.target.role !== 'handle' || event.target.handleType !== 'node-transform') return false
    return Boolean(event.target.nodeId)
  },
  start: (event, context) => {
    const active = context.state.read('interactionSession').active
    if (active) {
      if (active.kind !== 'nodeTransform' || active.pointerId !== event.pointerId) return null
    } else {
      const nodeId = event.target.nodeId
      if (!nodeId) return null
      const nodeRect = context.query.canvas.nodeRect(nodeId)
      if (!nodeRect) return null
      if (nodeRect.node.locked) return null

      let started = false
      if (event.target.transformKind === 'resize' && event.target.resizeDirection) {
        started = context.nodeInput.transform.startResize({
          nodeId,
          pointer: event.pointer,
          handle: event.target.resizeDirection,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation
        })
      }
      if (event.target.transformKind === 'rotate') {
        started = context.nodeInput.transform.startRotate({
          nodeId,
          pointer: event.pointer,
          rect: nodeRect.rect,
          rotation: nodeRect.rotation
        })
      }
      if (!started) return null
    }
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.nodeInput.transform.update(
          nextEvent.pointer,
          DEFAULT_TUNING.nodeTransform.minSize
        )
      },
      end: (nextEvent, nextContext) => {
        nextContext.nodeInput.transform.end(nextEvent.pointer)
      },
      cancel: (_reason, nextContext) => {
        nextContext.nodeInput.transform.cancel()
      }
    }
  }
})
