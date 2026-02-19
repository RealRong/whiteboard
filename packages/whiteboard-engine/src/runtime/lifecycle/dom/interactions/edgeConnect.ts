import type { LifecycleContext } from '../../../../context'
import { toPointerInput } from '../../../../context'
import type { InteractionHandler } from './types'
import { readPointerId } from './types'

export const createEdgeConnectHandler = (
  context: LifecycleContext
): InteractionHandler => ({
  watch: (listener) => context.state.watch('edgeConnect', listener),
  getActive: () => {
    const edgeConnect = context.state.read('edgeConnect')
    return edgeConnect.isConnecting ? edgeConnect : undefined
  },
  getPointerId: readPointerId,
  onMove: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.edgeConnect.updateTo(pointer)
  },
  onUp: (event) => {
    const pointer = toPointerInput(context.runtime.viewport, event)
    context.runtime.interaction.edgeConnect.commitTo(pointer)
  }
})
