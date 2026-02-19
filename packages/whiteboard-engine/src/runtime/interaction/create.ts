import type { RuntimeInteraction } from '@engine-types/instance/runtime'
import type { InteractionContext } from '../../context'
import { EdgeConnect } from './EdgeConnect'
import { MindmapDrag } from './MindmapDrag'
import { NodeDrag } from './NodeDrag'
import { NodeTransform } from './NodeTransform'
import { RoutingDrag } from './RoutingDrag'

export const createInteractions = (
  context: InteractionContext
): RuntimeInteraction => {
  return {
    edgeConnect: new EdgeConnect(context),
    routingDrag: new RoutingDrag(context),
    nodeDrag: new NodeDrag(context),
    mindmapDrag: new MindmapDrag(context),
    nodeTransform: new NodeTransform(context)
  }
}
