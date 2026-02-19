import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import type { InteractionHandler } from './types'
import { readPointerId } from './types'

export const createNodeDragHandler = (
  context: LifecycleContext
): InteractionHandler => ({
  watch: (listener) => context.state.watch('nodeDrag', listener),
  getActive: () => context.state.read('nodeDrag').active,
  getPointerId: readPointerId,
  onMove: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeDrag.update({ pointer })
  },
  onUp: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeDrag.end({ pointer })
  },
  onCancel: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.nodeDrag.cancel({ pointer })
  }
})
