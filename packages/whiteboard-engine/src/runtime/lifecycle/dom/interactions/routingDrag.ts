import type { LifecycleContext } from '../../../../context'
import type { InteractionBindingSpec } from './types'
import { readPointerId } from './types'

export const createRoutingDragSpec = (
  context: LifecycleContext
): InteractionBindingSpec => ({
  watch: (listener) => context.state.watch('routingDrag', listener),
  getActive: () => context.state.read('routingDrag').active,
  getPointerId: readPointerId,
  toMoveIntent: (pointer) => ({
    type: 'routing-drag.update',
    pointer
  }),
  toUpIntent: (pointer) => ({
    type: 'routing-drag.end',
    pointer
  }),
  toCancelIntent: (pointer) => ({
    type: 'routing-drag.cancel',
    pointer
  })
})
