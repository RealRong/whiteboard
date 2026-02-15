import type { Instance } from '@engine-types/instance'
import { createNodeDrag, type NodeDragBinding } from '../../bindings'
import {
  createNodeTransform,
  type NodeTransformBinding
} from '../../bindings'

export type NodeBindings = {
  nodeDrag: NodeDragBinding
  nodeTransform: NodeTransformBinding
}

export const createNodeBindings = (instance: Instance): NodeBindings => {
  return {
    nodeDrag: createNodeDrag({
      state: instance.state,
      events: instance.runtime.events,
      nodeDragCommands: instance.commands.nodeDrag
    }),
    nodeTransform: createNodeTransform({
      state: instance.state,
      events: instance.runtime.events,
      nodeTransformCommands: instance.commands.nodeTransform
    })
  }
}
