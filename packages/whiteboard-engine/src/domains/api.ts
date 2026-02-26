import type { Commands } from '@engine-types/commands'
import type {
  EdgeDomainApi,
  EdgeEntityApi,
  MindmapDomainApi,
  MindmapEntityApi,
  NodeDomainApi,
  NodeEntityApi,
  SelectionDomainApi,
  SelectionStateReader,
  ViewportDomainApi
} from '@engine-types/domains'
import type { Query } from '@engine-types/instance/query'
import type { View } from '@engine-types/instance/view'
import type { EdgeId, MindmapId, NodeId } from '@whiteboard/core/types'

type NodeOptions = {
  commands: Pick<Commands, 'node' | 'order' | 'group'>
  query: Query
  view: View
}

type EdgeOptions = {
  commands: Pick<Commands, 'edge' | 'order'>
  query: Query
  view: View
}

type MindmapOptions = {
  commands: Pick<Commands, 'mindmap'>
  view: View
}

type SelectionOptions = {
  commands: Pick<Commands, 'selection'>
  state: SelectionStateReader
  view: View
}

type ViewportOptions = {
  commands: Pick<Commands, 'viewport'>
  query: Query
  view: View
}

export const createNodeDomainApi = ({
  commands,
  query,
  view
}: NodeOptions): NodeDomainApi => ({
  commands: {
    create: commands.node.create,
    update: commands.node.update,
    updateData: commands.node.updateData,
    updateManyPosition: commands.node.updateManyPosition,
    delete: commands.node.delete,
    order: commands.order.node,
    group: commands.group
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
  query: {
    rect: () => api.query.rect(nodeId),
    view: () => api.view.getById(nodeId)
  }
})

export const createEdgeDomainApi = ({
  commands,
  query,
  view
}: EdgeOptions): EdgeDomainApi => ({
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

export const createMindmapDomainApi = ({
  commands,
  view
}: MindmapOptions): MindmapDomainApi => ({
  commands: commands.mindmap,
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
  query: {
    tree: () => api.query.getTree(mindmapId)
  }
})

export const createSelectionDomainApi = ({
  commands,
  state,
  view
}: SelectionOptions): SelectionDomainApi => ({
  commands: commands.selection,
  query: {
    get: () => state.read('selection'),
    getSelectedNodeIds: commands.selection.getSelectedNodeIds,
    getSelectedEdgeId: () => state.read('selection').selectedEdgeId,
    getMode: () => state.read('selection').mode
  },
  view: {
    getEdgeSelection: () => view.getState().edges.selection,
    subscribe: view.subscribe
  }
})

export const createViewportDomainApi = ({
  commands,
  query,
  view
}: ViewportOptions): ViewportDomainApi => ({
  commands: commands.viewport,
  query: query.viewport,
  view: {
    get: () => view.getState().viewport,
    subscribe: view.subscribe
  }
})
