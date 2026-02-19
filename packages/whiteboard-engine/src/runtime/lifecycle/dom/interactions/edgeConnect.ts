import type { LifecycleContext } from '../../../../context'
import type { InteractionBindingSpec } from './types'
import { readPointerId } from './types'

export const createEdgeConnectSpec = (
  context: LifecycleContext
): InteractionBindingSpec => ({
  watch: (listener) => context.state.watch('edgeConnect', listener),
  getActive: () => {
    const edgeConnect = context.state.read('edgeConnect')
    return edgeConnect.isConnecting ? edgeConnect : undefined
  },
  getPointerId: readPointerId,
  toMoveIntent: (pointer) => ({
    type: 'edge-connect.updateTo',
    pointer
  }),
  toUpIntent: (pointer) => ({
    type: 'edge-connect.commitTo',
    pointer
  })
})
