import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import type { InteractionHandler } from './types'
import { readPointerId } from './types'

export const createRoutingDragHandler = (
  context: LifecycleContext
): InteractionHandler => ({
  watch: (listener) => context.state.watch('routingDrag', listener),
  getActive: () => context.state.read('routingDrag').active,
  getPointerId: readPointerId,
  onMove: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.routingDrag.update({ pointer })
  },
  onUp: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.routingDrag.end({ pointer })
  },
  onCancel: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.routingDrag.cancel({ pointer })
  }
})
