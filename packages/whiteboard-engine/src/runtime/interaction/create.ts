import type { InternalInstance } from '@engine-types/instance/instance'
import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import { EdgeConnect } from './EdgeConnect'
import { MindmapDrag } from './MindmapDrag'
import { NodeDrag } from './NodeDrag'
import { NodeTransform } from './NodeTransform'
import { RoutingDrag } from './RoutingDrag'

export const createInteractions = (instance: InternalInstance): RuntimeInteraction => {
  return {
    edgeConnect: new EdgeConnect(instance),
    routingDrag: new RoutingDrag(instance),
    nodeDrag: new NodeDrag(instance),
    mindmapDrag: new MindmapDrag(instance),
    nodeTransform: new NodeTransform(instance)
  }
}
