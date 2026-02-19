import type { LifecycleContext } from '../../../../context'
import { createEdgeConnectSpec } from './edgeConnect'
import { createMindmapDragSpec } from './mindmapDrag'
import { createNodeDragSpec } from './nodeDrag'
import { createNodeTransformSpec } from './nodeTransform'
import { createRoutingDragSpec } from './routingDrag'
import type { InteractionBindingSpec } from './types'

export type { InteractionBindingSpec } from './types'

export const createInteractionSpecs = (
  context: LifecycleContext
): InteractionBindingSpec[] => [
  createEdgeConnectSpec(context),
  createRoutingDragSpec(context),
  createNodeDragSpec(context),
  createNodeTransformSpec(context),
  createMindmapDragSpec(context)
]
