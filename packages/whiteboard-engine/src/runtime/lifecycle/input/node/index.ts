import type { Instance } from '@engine-types/instance'
import { createNodeDragWindowBinding, type NodeDragWindowBinding } from '../../bindings'
import {
  createNodeTransformWindowBinding,
  type NodeTransformWindowBinding
} from '../../bindings'

export type NodeInputWindowBindings = {
  nodeDragWindowBinding: NodeDragWindowBinding
  nodeTransformWindowBinding: NodeTransformWindowBinding
}

export const createNodeInputWindowBindings = (instance: Instance): NodeInputWindowBindings => {
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
