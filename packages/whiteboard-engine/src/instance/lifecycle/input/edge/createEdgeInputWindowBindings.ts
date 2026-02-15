import type { WhiteboardInstance } from '@engine-types/instance'
import {
  createEdgeRoutingPointDragWindowBinding,
  type EdgeRoutingPointDragWindowBinding
} from '../../bindings/bindEdgeRoutingPointDragWindow'
import { createEdgeConnectWindowBinding, type EdgeConnectWindowBinding } from '../../bindings/bindEdgeConnectWindow'

export type EdgeInputWindowBindings = {
  edgeConnectWindowBinding: EdgeConnectWindowBinding
  edgeRoutingPointDragWindowBinding: EdgeRoutingPointDragWindowBinding
}

export const createEdgeInputWindowBindings = (instance: WhiteboardInstance): EdgeInputWindowBindings => {
  return {
    edgeConnectWindowBinding: createEdgeConnectWindowBinding({
      state: instance.state,
      events: instance.runtime.events,
      edgeConnectCommands: instance.commands.edgeConnect
    }),
    edgeRoutingPointDragWindowBinding: createEdgeRoutingPointDragWindowBinding({
      state: instance.state,
      events: instance.runtime.events,
      edgeCommands: instance.commands.edge
    })
  }
}
