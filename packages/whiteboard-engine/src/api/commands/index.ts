import type { Commands } from '@engine-types/commands'
import type { CommandContext } from '../../context'
import { createBase } from './base'
import { createEdge } from './edge'
import { createGroup } from './group'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createOrder } from './order'
import { createSelection } from './selection'
import { createTransient } from './transient'
import { createViewport } from './viewport'

export const createCommands = ({
  instance,
  graph,
  syncGraph
}: CommandContext): Commands => {
  const selection = createSelection(instance)
  const transient = createTransient({
    instance,
    graph,
    syncGraph
  })

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
