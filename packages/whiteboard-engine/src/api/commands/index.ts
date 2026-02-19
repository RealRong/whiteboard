import type { Commands } from '@engine-types/commands'
import type { GraphProjector } from '@engine-types/graph'
import type { InternalInstance } from '@engine-types/instance/instance'
import { createBase } from './base'
import { createEdge } from './edge'
import { createGroup } from './group'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createOrder } from './order'
import { createSelection } from './selection'
import { createTransient } from './transient'
import { createViewport } from './viewport'

export const createCommands = (
  instance: InternalInstance,
  graph: GraphProjector
): Commands => {
  const selection = createSelection(instance)
  const transient = createTransient(instance, graph)

  return {
    ...createBase(instance),
    selection,
    ...createEdge(instance),
    ...createNode(instance),
    transient,
    order: createOrder(instance),
    viewport: createViewport(instance),
    group: createGroup(instance),
    ...createMindmap(instance)
  }
}
