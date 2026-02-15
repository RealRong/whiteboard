import type { Instance } from '@engine-types/instance'
import {
  createRoutingDrag,
  type RoutingDragBinding
} from '../../bindings'
import { createEdgeConnect, type EdgeConnectBinding } from '../../bindings'

export type EdgeBindings = {
  edgeConnect: EdgeConnectBinding
  routingDrag: RoutingDragBinding
}

export const createEdgeBindings = (instance: Instance): EdgeBindings => {
  return {
    edgeConnect: createEdgeConnect({
      state: instance.state,
      events: instance.runtime.events,
      edgeConnectCommands: instance.commands.edgeConnect
    }),
    routingDrag: createRoutingDrag({
      state: instance.state,
      events: instance.runtime.events,
      edgeCommands: instance.commands.edge
    })
  }
}
