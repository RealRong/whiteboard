import type { LifecycleContext } from '../../../../context'
import { createEdgeConnectHandler } from './edgeConnect'
import { createMindmapDragHandler } from './mindmapDrag'
import { createNodeDragHandler } from './nodeDrag'
import { createNodeTransformHandler } from './nodeTransform'
import { createRoutingDragHandler } from './routingDrag'
import type { InteractionHandler } from './types'

export type { InteractionHandler } from './types'

export const createInteractionHandlers = (
  context: LifecycleContext
): InteractionHandler[] => [
  createEdgeConnectHandler(context),
  createRoutingDragHandler(context),
  createNodeDragHandler(context),
  createNodeTransformHandler(context),
  createMindmapDragHandler(context)
]
