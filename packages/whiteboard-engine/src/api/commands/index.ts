import type { Commands } from '@engine-types/commands'
import type { GraphProjector } from '@engine-types/graph'
import type { InternalInstance } from '@engine-types/instance/instance'
import { createBase } from './base'
import { createEdge } from './edge'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createSelection } from './selection'
import { createTransient } from './transient'

export const createCommands = (
  instance: InternalInstance,
  graph: GraphProjector,
  replaceDoc: (doc: Parameters<Commands['doc']['replace']>[0]) => void
): Commands => {
  const { core } = instance.runtime
  const selection = createSelection(instance)
  const transient = createTransient(instance, graph)

  return {
    ...createBase(instance, replaceDoc),
    selection,
    ...createEdge(instance),
    ...createNode(instance, transient),
    transient,
    order: core.commands.order,
    viewport: core.commands.viewport,
    group: core.commands.group as Commands['group'],
    ...createMindmap(instance)
  }
}
