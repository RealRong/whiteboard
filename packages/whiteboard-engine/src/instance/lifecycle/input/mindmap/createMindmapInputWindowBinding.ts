import type { WhiteboardInstance } from '@engine-types/instance'
import { createMindmapDragWindowBinding, type MindmapDragWindowBinding } from '../../bindings/bindMindmapDragWindow'

export const createMindmapInputWindowBinding = (instance: WhiteboardInstance): MindmapDragWindowBinding => {
  return createMindmapDragWindowBinding({
    state: instance.state,
    events: instance.runtime.events,
    mindmapCommands: instance.commands.mindmap
  })
}
