import type { Commands } from '@engine-types/commands'
import type {
  DomainApis,
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
import type { EngineRead } from '@engine-types/instance/read'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { EdgeId, MindmapId, NodeId } from '@whiteboard/core/types'

type NodeOptions = {
  commands: Pick<Commands, 'node' | 'order' | 'group'>
  query: Query
  read: EngineRead
}

type EdgeOptions = {
  commands: Pick<Commands, 'edge' | 'order'>
  query: Query
  read: EngineRead
}

type MindmapOptions = {
  commands: Pick<Commands, 'mindmap'>
  read: EngineRead
}

type SelectionOptions = {
  commands: Pick<Commands, 'selection'>
  state: SelectionStateReader
  read: EngineRead
}

type ViewportOptions = {
  commands: Pick<Commands, 'viewport'>
  query: Query
  read: EngineRead
}

type DomainApisOptions = {
  instance: Pick<InternalInstance, 'commands' | 'query' | 'read' | 'state'>
}

export const createNodeDomainApi = ({
  commands,
  query,
  read
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
  read: {
    get: () => {
      const ids = read.get.nodeIds()
      const byId = new Map<NodeId, NonNullable<ReturnType<typeof read.get.nodeById>>>()
      ids.forEach((id) => {
        const entry = read.get.nodeById(id)
        if (!entry) return
        byId.set(id, entry)
      })
      return {
        ids,
        byId
      }
    },
    getById: (id) => read.get.nodeById(id)
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
    read: () => api.read.getById(nodeId)
  }
})

export const createEdgeDomainApi = ({
  commands,
  query,
  read
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
  read: {
    get: () => {
      const ids = read.get.edgeIds()
      const byId = new Map<EdgeId, NonNullable<ReturnType<typeof read.get.edgeById>>>()
      ids.forEach((id) => {
        const entry = read.get.edgeById(id)
        if (!entry) return
        byId.set(id, entry)
      })
      return {
        ids,
        byId,
        selection: {
          endpoints: read.get.edgeSelectedEndpoints()
        }
      }
    },
    getById: (id) => read.get.edgeById(id)
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
      const entry = api.read.getById(edgeId)
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
      const entry = api.read.getById(edgeId)
      if (!entry) return false
      api.commands.removeRoutingPoint(entry.edge, index)
      return true
    },
    resetRouting: () => {
      const entry = api.read.getById(edgeId)
      if (!entry) return
      api.commands.resetRouting(entry.edge)
    },
    bringToFront: () => api.commands.order.bringToFront([edgeId]),
    sendToBack: () => api.commands.order.sendToBack([edgeId]),
    bringForward: () => api.commands.order.bringForward([edgeId]),
    sendBackward: () => api.commands.order.sendBackward([edgeId])
  },
  query: {
    read: () => api.read.getById(edgeId)
  }
})

export const createMindmapDomainApi = ({
  commands,
  read
}: MindmapOptions): MindmapDomainApi => ({
  commands: commands.mindmap,
  query: {
    getTree: (id) => read.get.mindmapById(id)
  },
  read: {
    get: () => {
      const ids = read.get.mindmapIds()
      const byId = new Map<NodeId, NonNullable<ReturnType<typeof read.get.mindmapById>>>()
      ids.forEach((id) => {
        const entry = read.get.mindmapById(id)
        if (!entry) return
        byId.set(id, entry)
      })
      return {
        ids,
        byId
      }
    }
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
  read
}: SelectionOptions): SelectionDomainApi => ({
  commands: commands.selection,
  query: {
    get: () => state.read('selection'),
    getSelectedNodeIds: commands.selection.getSelectedNodeIds,
    getSelectedEdgeId: () => state.read('selection').selectedEdgeId,
    getMode: () => state.read('selection').mode
  },
  read: {
    getEdgeSelection: () => ({
      endpoints: read.get.edgeSelectedEndpoints()
    })
  }
})

export const createViewportDomainApi = ({
  commands,
  query,
  read
}: ViewportOptions): ViewportDomainApi => ({
  commands: commands.viewport,
  query: query.viewport,
  read: {
    get: () => ({
      transform: read.get.viewportTransform()
    })
  }
})

export const createDomainApis = ({
  instance
}: DomainApisOptions): DomainApis => ({
  node: createNodeDomainApi({
    commands: instance.commands,
    query: instance.query,
    read: instance.read
  }),
  edge: createEdgeDomainApi({
    commands: instance.commands,
    query: instance.query,
    read: instance.read
  }),
  mindmap: createMindmapDomainApi({
    commands: instance.commands,
    read: instance.read
  }),
  selection: createSelectionDomainApi({
    commands: instance.commands,
    state: instance.state,
    read: instance.read
  }),
  viewport: createViewportDomainApi({
    commands: instance.commands,
    query: instance.query,
    read: instance.read
  })
})
