import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import type { InteractionHandler } from './types'
import { readPointerId } from './types'

export const createMindmapDragHandler = (
  context: LifecycleContext
): InteractionHandler => ({
  watch: (listener) => context.state.watch('mindmapDrag', listener),
  getActive: () => context.state.read('mindmapDrag').active,
  getPointerId: readPointerId,
  onMove: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.mindmapDrag.update({ pointer })
  },
  onUp: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.mindmapDrag.end({ pointer })
  },
  onCancel: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.mindmapDrag.cancel({ pointer })
  }
})
