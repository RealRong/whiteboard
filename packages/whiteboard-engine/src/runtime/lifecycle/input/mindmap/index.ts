import type { Instance } from '@engine-types/instance'
import { createMindmapDragWindowBinding, type MindmapDragWindowBinding } from '../../bindings'

export const createMindmapInputWindowBinding = (instance: Instance): MindmapDragWindowBinding => {
  return createMindmapDragWindowBinding({
    state: instance.state,
    events: instance.runtime.events,
    mindmapCommands: instance.commands.mindmap
  })
}
