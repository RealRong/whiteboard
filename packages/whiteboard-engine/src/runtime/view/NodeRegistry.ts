import type {
  State,
} from '@engine-types/instance/state'
import type { GraphProjector } from '@engine-types/graph'
import type { Query } from '@engine-types/instance/query'
import type {
  NodeTransformHandle,
  NodeViewItem,
} from '@engine-types/instance/view'
import type { Node, NodeId } from '@whiteboard/core/types'
import {
  projectNodeHandles,
  projectNodeItem,
  type NodeViewContext
} from './project'
import { toLayerOrderedCanvasNodes } from '../query'
import { isSameIdOrder } from '../../view/shared'

type NodeViewItemEntry = NodeViewItem
type NodeHandleEntry = NodeTransformHandle[]
type NodeRenderContext = NodeViewContext
type SyncCanvasNodesOptions = {
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
  fullSync?: boolean
}
type NodeHandleSyncMode = 'auto' | 'always' | 'never'

export type NodeStateSyncKey =
  | 'selection'
  | 'groupHovered'
  | 'tool'
  | 'viewport'

type Options = {
  state: State
  query: Query
  graph: GraphProjector
}

export type NodeRegistry = {
  syncCanvasNodes: (options?: SyncCanvasNodesOptions) => void
  syncState: (key: NodeStateSyncKey) => void
  getNodeItemsMap: () => ReadonlyMap<NodeId, NodeViewItemEntry>
  getNodeHandlesMap: () => ReadonlyMap<NodeId, NodeHandleEntry>
  getNodeIds: () => NodeId[]
}

const diffSelection = (
  previous: Set<NodeId>,
  next: Set<NodeId>
) => {
  const changed = new Set<NodeId>()
  previous.forEach((nodeId) => {
    if (!next.has(nodeId)) {
      changed.add(nodeId)
    }
  })
  next.forEach((nodeId) => {
    if (!previous.has(nodeId)) {
      changed.add(nodeId)
    }
  })
  return changed
}

export const createNodeRegistry = ({
  state,
  query,
  graph
}: Options): NodeRegistry => {
  let nodeIds: NodeId[] = []
  let canvasNodeById = new Map<NodeId, Node>()
  let nodeItemsById = new Map<NodeId, NodeViewItemEntry>()
  let nodeHandlesById = new Map<NodeId, NodeHandleEntry>()
  let activeTool = state.read('tool')
  let selectedNodeIds = state.read('selection').selectedNodeIds
  let hoveredGroupId = state.read('groupHovered')
  let zoom = state.read('viewport').zoom

  const readRenderContext = (): NodeRenderContext => ({
    activeTool: state.read('tool'),
    selectedNodeIds: state.read('selection').selectedNodeIds,
    hoveredGroupId: state.read('groupHovered'),
    zoom: state.read('viewport').zoom
  })

  const ensureMutableMap = <T>(current: Map<NodeId, T>, next: Map<NodeId, T>) =>
    next === current ? new Map(current) : next

  const resolveRenderContext = (context?: NodeRenderContext): NodeRenderContext =>
    context ?? {
      activeTool,
      selectedNodeIds,
      hoveredGroupId,
      zoom
    }

  const syncNodeItemsByIds = (targetNodeIds: Iterable<NodeId>, context?: NodeRenderContext) => {
    const resolvedContext = resolveRenderContext(context)
    let nextById = nodeItemsById
    let changed = false

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeItemsById.get(nodeId)
      if (!node) {
        if (!previous) continue
        nextById = ensureMutableMap(nodeItemsById, nextById)
        nextById.delete(nodeId)
        changed = true
        continue
      }

      const next = projectNodeItem({
        node,
        query,
        context: resolvedContext,
        previous
      })
      if (previous === next) continue
      nextById = ensureMutableMap(nodeItemsById, nextById)
      nextById.set(nodeId, next)
      changed = true
    }

    if (!changed) return
    nodeItemsById = nextById
  }

  const syncNodeHandlesByIds = (targetNodeIds: Iterable<NodeId>, context?: NodeRenderContext) => {
    const resolvedContext = resolveRenderContext(context)
    let nextById = nodeHandlesById
    let changed = false

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeHandlesById.get(nodeId)
      const next = node
        ? projectNodeHandles({
          node,
          query,
          context: resolvedContext,
          previous
        })
        : undefined

      if (!next) {
        if (!previous) continue
        nextById = ensureMutableMap(nodeHandlesById, nextById)
        nextById.delete(nodeId)
        changed = true
        continue
      }

      if (previous === next) continue
      nextById = ensureMutableMap(nodeHandlesById, nextById)
      nextById.set(nodeId, next)
      changed = true
    }

    if (!changed) return
    nodeHandlesById = nextById
  }

  const syncNodeVisualsByIds = (
    targetNodeIds: Iterable<NodeId>,
    options?: {
      context?: NodeRenderContext
      handleSync?: NodeHandleSyncMode
    }
  ) => {
    const context = options?.context
    const handleSync = options?.handleSync ?? 'auto'
    syncNodeItemsByIds(targetNodeIds, context)
    const shouldSyncHandles =
      handleSync === 'always' ||
      (handleSync === 'auto' && (context?.activeTool ?? activeTool) === 'select')
    if (shouldSyncHandles) {
      syncNodeHandlesByIds(targetNodeIds, context)
    }
  }

  const applyNodeOrder = (nextNodeIds: NodeId[]) => {
    if (isSameIdOrder(nodeIds, nextNodeIds)) return
    nodeIds = nextNodeIds
  }

  const clearNodeHandles = () => {
    if (!nodeHandlesById.size) return
    nodeHandlesById = new Map()
  }

  const syncCanvasNodesFull = (context?: NodeRenderContext) => {
    const orderedNodes = toLayerOrderedCanvasNodes(graph.read().canvasNodes)
    const nextNodeIds = orderedNodes.map((node) => node.id)
    const nextById = new Map<NodeId, Node>()
    const changedNodeIds = new Set<NodeId>()
    const removedNodeIds = new Set<NodeId>()

    orderedNodes.forEach((node) => {
      nextById.set(node.id, node)
      if (canvasNodeById.get(node.id) !== node) {
        changedNodeIds.add(node.id)
      }
    })
    canvasNodeById.forEach((_, nodeId) => {
      if (!nextById.has(nodeId)) {
        removedNodeIds.add(nodeId)
      }
    })
    canvasNodeById = nextById

    applyNodeOrder(nextNodeIds)

    if (removedNodeIds.size) {
      syncNodeVisualsByIds(removedNodeIds, {
        context,
        handleSync: 'always'
      })
    }

    if (changedNodeIds.size) {
      syncNodeVisualsByIds(changedNodeIds, {
        context,
        handleSync: 'auto'
      })
    }
  }

  const syncCanvasNodesDirty = (dirtyNodeIds: NodeId[], context?: NodeRenderContext) => {
    const dirtySet = new Set(dirtyNodeIds)
    if (!dirtySet.size) return

    let nextById = canvasNodeById
    const changedNodeIds = new Set<NodeId>()

    dirtySet.forEach((nodeId) => {
      const previous = canvasNodeById.get(nodeId)
      const next = graph.readNode(nodeId)
      if (!previous && !next) return

      if (!previous && next) {
        nextById = ensureMutableMap(canvasNodeById, nextById)
        nextById.set(nodeId, next)
        changedNodeIds.add(nodeId)
        return
      }

      if (previous && !next) {
        nextById = ensureMutableMap(canvasNodeById, nextById)
        nextById.delete(nodeId)
        changedNodeIds.add(nodeId)
        return
      }

      if (previous === next || !next) return
      nextById = ensureMutableMap(canvasNodeById, nextById)
      nextById.set(nodeId, next)
      changedNodeIds.add(nodeId)
    })

    if (nextById !== canvasNodeById) {
      canvasNodeById = nextById
    }
    if (!changedNodeIds.size) return

    syncNodeVisualsByIds(changedNodeIds, {
      context,
      handleSync: 'auto'
    })
  }

  const syncCanvasNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(graph.read().canvasNodes).map(
      (node) => node.id
    )
    applyNodeOrder(nextNodeIds)
  }

  const syncCanvasNodes: NodeRegistry['syncCanvasNodes'] = (options) => {
    const dirtyNodeIds = options?.dirtyNodeIds
    const orderChanged = options?.orderChanged
    const fullSync = options?.fullSync
    const context = readRenderContext()

    if (fullSync) {
      syncCanvasNodesFull(context)
      return
    }

    if (dirtyNodeIds?.length) {
      syncCanvasNodesDirty(dirtyNodeIds, context)
      if (orderChanged) {
        syncCanvasNodeOrder()
      }
      return
    }
    if (orderChanged) {
      syncCanvasNodeOrder()
      return
    }
    syncCanvasNodesFull(context)
  }

  const syncState: NodeRegistry['syncState'] = (key) => {
    if (key === 'selection') {
      const nextSelectedNodeIds = state.read('selection').selectedNodeIds
      if (nextSelectedNodeIds === selectedNodeIds) return

      const changedNodeIds = diffSelection(selectedNodeIds, nextSelectedNodeIds)
      selectedNodeIds = nextSelectedNodeIds
      if (!changedNodeIds.size || activeTool === 'edge') return

      syncNodeVisualsByIds(changedNodeIds, {
        handleSync: 'always'
      })
      return
    }

    if (key === 'groupHovered') {
      const nextHoveredGroupId = state.read('groupHovered')
      if (nextHoveredGroupId === hoveredGroupId) return

      const changedNodeIds = new Set<NodeId>()
      if (hoveredGroupId) {
        changedNodeIds.add(hoveredGroupId)
      }
      if (nextHoveredGroupId) {
        changedNodeIds.add(nextHoveredGroupId)
      }
      hoveredGroupId = nextHoveredGroupId
      if (!changedNodeIds.size) return

      syncNodeVisualsByIds(changedNodeIds, {
        handleSync: 'never'
      })
      return
    }

    if (key === 'tool') {
      const nextTool = state.read('tool')
      if (nextTool === activeTool) return

      activeTool = nextTool
      syncNodeItemsByIds(nodeIds)
      if (activeTool === 'select') {
        syncNodeHandlesByIds(selectedNodeIds)
      } else {
        clearNodeHandles()
      }
      return
    }

    const nextZoom = state.read('viewport').zoom
    if (nextZoom === zoom) return

    zoom = nextZoom
    syncNodeItemsByIds(nodeIds)
    if (activeTool === 'select') {
      syncNodeHandlesByIds(selectedNodeIds)
    }
  }

  return {
    syncCanvasNodes,
    syncState,
    getNodeItemsMap: () => nodeItemsById,
    getNodeHandlesMap: () => nodeHandlesById,
    getNodeIds: () => nodeIds
  }
}
