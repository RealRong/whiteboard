import type { Commands } from '@engine-types/commands'
import type { NodeDomainApi, NodeEntityApi } from '@engine-types/domains'
import type { InputSessionContext } from '@engine-types/input'
import type { Query } from '@engine-types/instance/query'
import type { View } from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core/types'

type Options = {
  commands: Pick<Commands, 'node' | 'order' | 'group'>
  nodeInput: InputSessionContext['nodeInput']
  query: Query
  view: View
}

export const createNodeDomainApi = ({
  commands,
  nodeInput,
  query,
  view
}: Options): NodeDomainApi => ({
  commands: {
    create: commands.node.create,
    update: commands.node.update,
    updateData: commands.node.updateData,
    updateManyPosition: commands.node.updateManyPosition,
    delete: commands.node.delete,
    order: commands.order.node,
    group: commands.group
  },
  interaction: {
    drag: nodeInput.drag,
    transform: nodeInput.transform
  },
  query: {
    rects: query.canvas.nodeRects,
    rect: query.canvas.nodeRect,
    idsInRect: query.canvas.nodeIdsInRect
  },
  view: {
    get: () => view.getState().nodes,
    getById: (id) => view.getState().nodes.byId.get(id),
    subscribe: view.subscribe
  }
})

export const bindNodeDomainApiById = (
  api: NodeDomainApi,
  nodeId: NodeId
): NodeEntityApi => ({
  id: nodeId,
  commands: {
    update: (patch) => api.commands.update(nodeId, patch),
    updateData: (patch) => api.commands.updateData(nodeId, patch),
    delete: () => api.commands.delete([nodeId]),
    bringToFront: () => api.commands.order.bringToFront([nodeId]),
    sendToBack: () => api.commands.order.sendToBack([nodeId]),
    bringForward: () => api.commands.order.bringForward([nodeId]),
    sendBackward: () => api.commands.order.sendBackward([nodeId])
  },
  interaction: {
    drag: {
      begin: (options) => api.interaction.drag.begin({
        nodeId,
        ...options
      }),
      updateDraft: api.interaction.drag.updateDraft,
      commitDraft: api.interaction.drag.commitDraft,
      cancelDraft: api.interaction.drag.cancelDraft
    },
    transform: {
      beginResize: (options) => api.interaction.transform.beginResize({
        nodeId,
        ...options
      }),
      beginRotate: (options) => api.interaction.transform.beginRotate({
        nodeId,
        ...options
      }),
      updateDraft: api.interaction.transform.updateDraft,
      commitDraft: api.interaction.transform.commitDraft,
      cancelDraft: api.interaction.transform.cancelDraft
    }
  },
  query: {
    rect: () => api.query.rect(nodeId),
    view: () => api.view.getById(nodeId)
  }
})
