import type { WhiteboardInstance } from '@engine-types/instance'
import { createNodeDragWindowBinding, type NodeDragWindowBinding } from '../../bindings/bindNodeDragWindow'
import {
  createNodeTransformWindowBinding,
  type NodeTransformWindowBinding
} from '../../bindings/bindNodeTransformWindow'

export type NodeInputWindowBindings = {
  nodeDragWindowBinding: NodeDragWindowBinding
  nodeTransformWindowBinding: NodeTransformWindowBinding
}

export const createNodeInputWindowBindings = (instance: WhiteboardInstance): NodeInputWindowBindings => {
  return {
    nodeDragWindowBinding: createNodeDragWindowBinding({
      state: instance.state,
      events: instance.runtime.events,
      nodeDragCommands: instance.commands.nodeDrag
    }),
    nodeTransformWindowBinding: createNodeTransformWindowBinding({
      state: instance.state,
      events: instance.runtime.events,
      nodeTransformCommands: instance.commands.nodeTransform
    })
  }
}
