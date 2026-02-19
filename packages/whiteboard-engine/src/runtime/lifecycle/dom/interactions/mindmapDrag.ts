import type { LifecycleContext } from '../../../../context'
import type { InteractionBindingSpec } from './types'
import { readPointerId } from './types'

export const createMindmapDragSpec = (
  context: LifecycleContext
): InteractionBindingSpec => ({
  watch: (listener) => context.state.watch('mindmapDrag', listener),
  getActive: () => context.state.read('mindmapDrag').active,
  getPointerId: readPointerId,
  toMoveIntent: (pointer) => ({
    type: 'mindmap-drag.update',
    pointer
  }),
  toUpIntent: (pointer) => ({
    type: 'mindmap-drag.end',
    pointer
  }),
  toCancelIntent: (pointer) => ({
    type: 'mindmap-drag.cancel',
    pointer
  })
})
