import type { Instance } from '@engine-types/instance'
import { createMindmapDrag, type MindmapDragBinding } from '../../bindings'

export const createMindmap = (instance: Instance): MindmapDragBinding => {
  return createMindmapDrag({
    state: instance.state,
    events: instance.runtime.events,
    mindmapCommands: instance.commands.mindmap
  })
}
