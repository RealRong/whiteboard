import type { Commands } from '@engine-types/commands'
import type { EdgeDomainApi, EdgeEntityApi } from '@engine-types/domains'
import type { Query } from '@engine-types/instance/query'
import type { View } from '@engine-types/instance/view'
import type { EdgeId } from '@whiteboard/core/types'

type Options = {
  commands: Pick<Commands, 'edge' | 'order'>
  query: Query
  view: View
}

export const createEdgeDomainApi = ({
  commands,
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
    insertRoutingPointAt: (pointWorld) => {
      const entry = api.view.getById(edgeId)
      if (!entry) return false
      const segmentIndex = api.query.nearestSegment(
        pointWorld,
        entry.path.points
      )
      api.commands.insertRoutingPoint(
        entry.edge,
        entry.path.points,
        segmentIndex,
        pointWorld
      )
      return true
    },
    removeRoutingPointAt: (index) => {
      const entry = api.view.getById(edgeId)
      if (!entry) return false
      api.commands.removeRoutingPoint(entry.edge, index)
      return true
    },
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
  query: {
    view: () => api.view.getById(edgeId)
  }
})
