import type {
  PointerSession
} from '@engine-types/input'
import { DEFAULT_TUNING } from '../../config'

export const createNodeTransform = (): PointerSession => ({
  kind: 'nodeTransform',
  priority: 100,
  canStart: (event, context) => {
    const active = context.state.read('nodeTransform').active
    if (!active) return false
    return active.drag.pointerId === event.pointerId
  },
  start: (event, context) => {
    const active = context.state.read('nodeTransform').active
    if (!active) return null
    if (active.drag.pointerId !== event.pointerId) return null
    return {
      pointerId: event.pointerId,
      update: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.nodeTransform.update({
          pointer: nextEvent.pointer,
          minSize: DEFAULT_TUNING.nodeTransform.minSize
        })
      },
      end: (nextEvent, nextContext) => {
        nextContext.runtime.interaction.nodeTransform.end({
          pointer: nextEvent.pointer
        })
      },
      cancel: (_reason, nextContext) => {
        nextContext.runtime.interaction.nodeTransform.cancel()
      }
    }
  }
})
