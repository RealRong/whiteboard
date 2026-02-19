import type { LifecycleContext } from '../../../../context'
import { DEFAULT_TUNING } from '../../../../config'
import type { InteractionBindingSpec } from './types'
import { readTransformPointerId } from './types'

export const createNodeTransformSpec = (
  context: LifecycleContext
): InteractionBindingSpec => ({
  watch: (listener) => context.state.watch('nodeTransform', listener),
  getActive: () => context.state.read('nodeTransform').active,
  getPointerId: readTransformPointerId,
  toMoveIntent: (pointer) => ({
    type: 'node-transform.update',
    pointer,
    minSize: DEFAULT_TUNING.nodeTransform.minSize
  }),
  toUpIntent: (pointer) => ({
    type: 'node-transform.end',
    pointer
  }),
  toCancelIntent: (pointer) => ({
    type: 'node-transform.cancel',
    pointer
  })
})
