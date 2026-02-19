import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import { DEFAULT_TUNING } from '../../../../config'
import type { InteractionHandler } from './types'
import { readTransformPointerId } from './types'

export const createNodeTransformHandler = (
  context: LifecycleContext
): InteractionHandler => ({
  watch: (listener) => context.state.watch('nodeTransform', listener),
  getActive: () => context.state.read('nodeTransform').active,
  getPointerId: readTransformPointerId,
  onMove: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeTransform.update({
      pointer,
      minSize: DEFAULT_TUNING.nodeTransform.minSize
    })
  },
  onUp: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeTransform.end({ pointer })
  },
  onCancel: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeTransform.cancel({ pointer })
  }
})
