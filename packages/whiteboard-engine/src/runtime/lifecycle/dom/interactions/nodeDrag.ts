import type { LifecycleContext } from '../../../../context'
import type { InteractionBindingSpec } from './types'
import { readPointerId } from './types'

export const createNodeDragSpec = (
  context: LifecycleContext
): InteractionBindingSpec => ({
  watch: (listener) => context.state.watch('nodeDrag', listener),
  getActive: () => context.state.read('nodeDrag').active,
  getPointerId: readPointerId,
  toMoveIntent: (pointer) => ({
    type: 'node-drag.update',
    pointer
  }),
  toUpIntent: (pointer) => ({
    type: 'node-drag.end',
    pointer
  }),
  toCancelIntent: (pointer) => ({
    type: 'node-drag.cancel',
    pointer
  })
})
