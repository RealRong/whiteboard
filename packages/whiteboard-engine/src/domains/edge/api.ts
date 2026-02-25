import type { Commands } from '@engine-types/commands'
import type { EdgeDomainApi, EdgeEntityApi } from '@engine-types/domains'
import type { InputSessionContext } from '@engine-types/input'
import type { Query } from '@engine-types/instance/query'
import type { View } from '@engine-types/instance/view'
import type { EdgeId } from '@whiteboard/core/types'

type Options = {
  commands: Pick<Commands, 'edge' | 'order'>
  edgeInput: InputSessionContext['edgeInput']
  query: Query
  view: View
}

export const createEdgeDomainApi = ({
  commands,
  edgeInput,
  query,
  view
}: Options): EdgeDomainApi => ({
  commands: {
    create: commands.edge.create,
    update: commands.edge.update,
    delete: commands.edge.delete,
    insertRoutingPoint: commands.edge.insertRoutingPoint,
    moveRoutingPoint: commands.edge.moveRoutingPoint,
    removeRoutingPoint: commands.edge.removeRoutingPoint,
    resetRouting: commands.edge.resetRouting,
    select: commands.edge.select,
    order: commands.order.edge
  },
  interaction: {
    connect: edgeInput.connect,
    routing: edgeInput.routing
  },
  query: {
    nearestSegment: query.geometry.nearestEdgeSegment
  },
  view: {
    get: () => view.getState().edges,
    getById: (id) => view.getState().edges.byId.get(id),
    subscribe: view.subscribe
  }
})

export const bindEdgeDomainApiById = (
  api: EdgeDomainApi,
  edgeId: EdgeId
): EdgeEntityApi => ({
  id: edgeId,
  commands: {
    update: (patch) => api.commands.update(edgeId, patch),
    delete: () => api.commands.delete([edgeId]),
    select: () => api.commands.select(edgeId),
    unselect: () => api.commands.select(undefined),
    insertRoutingPointAt: (pointWorld) =>
      api.interaction.routing.insertRoutingPointAt(edgeId, pointWorld),
    removeRoutingPointAt: (index) =>
      api.interaction.routing.removeRoutingPointAt(edgeId, index),
    resetRouting: () => {
      const entry = api.view.getById(edgeId)
      if (!entry) return
      api.commands.resetRouting(entry.edge)
    },
    bringToFront: () => api.commands.order.bringToFront([edgeId]),
    sendToBack: () => api.commands.order.sendToBack([edgeId]),
    bringForward: () => api.commands.order.bringForward([edgeId]),
    sendBackward: () => api.commands.order.sendBackward([edgeId])
  },
  interaction: {
    connect: {
      startReconnect: (end, pointer) =>
        api.interaction.connect.startReconnect(edgeId, end, pointer),
      updateConnect: api.interaction.connect.updateConnect,
      commitConnect: api.interaction.connect.commitConnect,
      cancelConnect: api.interaction.connect.cancelConnect
    },
    routing: {
      start: (index, pointer) =>
        api.interaction.routing.startRouting(edgeId, index, pointer),
      update: api.interaction.routing.updateRouting,
      end: api.interaction.routing.endRouting,
      cancel: api.interaction.routing.cancelRouting
    }
  },
  query: {
    view: () => api.view.getById(edgeId)
  }
})
