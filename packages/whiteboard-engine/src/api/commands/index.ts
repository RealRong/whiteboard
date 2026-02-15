import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { createBase } from './base'
import { createEdge } from './edge'
import { createMindmap } from './mindmap'
import { createNode } from './node'
import { createSelection } from './selection'
import { createTransient } from './transient'

export const createCommands = (instance: Instance): Commands => {
  const { core } = instance.runtime
  const selection = createSelection(instance)
  const transient = createTransient(instance)

  return {
    ...createBase(instance),
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
