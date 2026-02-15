import type { Commands } from '@engine-types/commands'
import type { Instance } from '@engine-types/instance'
import { createBaseCommands } from './base'
import { createEdgeCommands } from './edge'
import { createMindmapCommands } from './mindmap'
import { createNodeCommands } from './node'
import { createSelectionCommands } from './selection'
import { createTransientCommands } from './transient'

export const createCommands = (instance: Instance): Commands => {
  const { core } = instance.runtime
  const selection = createSelectionCommands(instance)
  const transient = createTransientCommands(instance)

  return {
    ...createBaseCommands(instance),
    selection,
    ...createEdgeCommands(instance),
    ...createNodeCommands(instance, transient),
    transient,
    order: core.commands.order,
    viewport: core.commands.viewport,
    group: core.commands.group as Commands['group'],
    ...createMindmapCommands(instance)
  }
}
