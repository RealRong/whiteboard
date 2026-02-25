import type { Commands } from '@engine-types/commands'
import type { MindmapDomainApi, MindmapEntityApi } from '@engine-types/domains'
import type { InputSessionContext } from '@engine-types/input'
import type { View } from '@engine-types/instance/view'
import type { MindmapId } from '@whiteboard/core/types'

type Options = {
  commands: Pick<Commands, 'mindmap'>
  mindmapInput: InputSessionContext['mindmapInput']
  view: View
}

export const createMindmapDomainApi = ({
  commands,
  mindmapInput,
  view
}: Options): MindmapDomainApi => ({
  commands: commands.mindmap,
  interaction: {
    drag: mindmapInput.drag
  },
  query: {
    getTree: (id) => view.getState().mindmap.byId.get(id)
  },
  view: {
    get: () => view.getState().mindmap,
    subscribe: view.subscribe
  }
})

export const bindMindmapDomainApiById = (
  api: MindmapDomainApi,
  mindmapId: MindmapId
): MindmapEntityApi => ({
  id: mindmapId,
  commands: {
    replace: (tree) => api.commands.replace(mindmapId, tree),
    delete: () => api.commands.delete([mindmapId]),
    addChild: (parentId, payload, options) =>
      api.commands.addChild(mindmapId, parentId, payload, options),
    addSibling: (nodeId, position, payload, options) =>
      api.commands.addSibling(
        mindmapId,
        nodeId,
        position,
        payload,
        options
      ),
    moveSubtree: (nodeId, newParentId, options) =>
      api.commands.moveSubtree(mindmapId, nodeId, newParentId, options),
    removeSubtree: (nodeId) =>
      api.commands.removeSubtree(mindmapId, nodeId),
    cloneSubtree: (nodeId, options) =>
      api.commands.cloneSubtree(mindmapId, nodeId, options),
    toggleCollapse: (nodeId, collapsed) =>
      api.commands.toggleCollapse(mindmapId, nodeId, collapsed),
    setNodeData: (nodeId, patch) =>
      api.commands.setNodeData(mindmapId, nodeId, patch),
    reorderChild: (parentId, fromIndex, toIndex) =>
      api.commands.reorderChild(mindmapId, parentId, fromIndex, toIndex),
    setSide: (nodeId, side) =>
      api.commands.setSide(mindmapId, nodeId, side),
    attachExternal: (targetId, payload, options) =>
      api.commands.attachExternal(mindmapId, targetId, payload, options),
    insertNode: (options) =>
      api.commands.insertNode({
        id: mindmapId,
        ...options
      }),
    moveSubtreeWithLayout: (options) =>
      api.commands.moveSubtreeWithLayout({
        id: mindmapId,
        ...options
      }),
    moveSubtreeWithDrop: (options) =>
      api.commands.moveSubtreeWithDrop({
        id: mindmapId,
        ...options
      })
  },
  interaction: {
    drag: {
      start: (nodeId, pointer) =>
        api.interaction.drag.start(
          mindmapId,
          nodeId,
          pointer
        ),
      update: api.interaction.drag.update,
      end: api.interaction.drag.end,
      cancel: api.interaction.drag.cancel
    }
  },
  query: {
    tree: () => api.query.getTree(mindmapId)
  }
})
