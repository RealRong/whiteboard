import type { WhiteboardCommands } from '@engine-types/commands'
import type { WhiteboardInstance } from '@engine-types/instance'
import { createBaseCommands } from './createBaseCommands'
import { createEdgeCommands } from './createEdgeCommands'
import { createMindmapCommands } from './createMindmapCommands'
import { createNodeCommands } from './createNodeCommands'
import { createSelectionCommands } from './createSelectionCommands'
import { createTransientCommands } from './createTransientCommands'

export const createWhiteboardCommands = (instance: WhiteboardInstance): WhiteboardCommands => {
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
    group: core.commands.group as WhiteboardCommands['group'],
    ...createMindmapCommands(instance)
  }
}
