import type {
  State,
} from '@engine-types/instance/state'
import type { GraphProjector } from '@engine-types/graph'
import type { Query } from '@engine-types/instance/query'
import type {
  ViewDebugMetric,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { Node, NodeId } from '@whiteboard/core'
import {
  projectNodeHandles,
  projectNodeItem,
  type NodeViewContext
} from './project'
import { toLayerOrderedCanvasNodes } from '../query'
import {
  createViewMetric,
  markMetricDirty,
  markMetricHit,
  markMetricRecompute,
  markMetricRevision,
  measureNow,
  snapshotViewMetric
} from '../../../common/view/metrics'
import {
  notifyListeners,
  watchEntity,
  watchSet,
  isSameIdOrder
} from '../../../common/view/shared'

type NodeViewItemEntry = ViewSnapshot['node.items'][number]
type NodeHandleEntry = ViewSnapshot['node.transformHandles'] extends Map<
  NodeId,
  infer TValue
>
  ? TValue
  : never
type NodeItemsViewValue = ViewSnapshot['node.items']
type NodeRenderContext = NodeViewContext
type SyncCanvasNodesOptions = {
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
  fullSync?: boolean
}
type NodeHandleSyncMode = 'auto' | 'always' | 'never'
type NodeVisualSyncResult = {
  nodeItemsChanged: boolean
  nodeHandlesChanged: boolean
}
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
  getNodeItems: () => NodeItemsViewValue
  getNodeHandlesMap: () => ViewSnapshot['node.transformHandles']
  getNodeIds: () => NodeId[]
  watchNodeIds: (listener: () => void) => () => void
  watchNodeItems: (listener: () => void) => () => void
  getNodeItem: (nodeId: NodeId) => NodeViewItemEntry | undefined
  watchNodeItem: (nodeId: NodeId, listener: () => void) => () => void
  watchNodeHandles: (listener: () => void) => () => void
  getNodeTransformHandles: (nodeId: NodeId) => NodeHandleEntry | undefined
  watchNodeTransformHandles: (nodeId: NodeId, listener: () => void) => () => void
  getNodeItemsMetric: () => ViewDebugMetric
  getNodeHandlesMetric: () => ViewDebugMetric
  resetNodeItemsMetric: () => void
  resetNodeHandlesMetric: () => void
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
  const nodeIdsListeners = new Set<() => void>()
  const nodeItemsListeners = new Set<() => void>()
  const nodeHandlesListeners = new Set<() => void>()
  const nodeItemListeners = new Map<NodeId, Set<() => void>>()
  const nodeHandleListeners = new Map<NodeId, Set<() => void>>()

  let nodeIds: NodeId[] = []
  let canvasNodeById = new Map<NodeId, Node>()
  let nodeItemsById = new Map<NodeId, NodeViewItemEntry>()
  let nodeItems: NodeItemsViewValue = []
  let nodeItemsDirty = true
  let nodeItemsMetric = createViewMetric()
  let nodeHandlesById = new Map<NodeId, NodeHandleEntry>()
  let nodeHandlesMetric = createViewMetric()
  let activeTool = state.read('tool')
  let selectedNodeIds = state.read('selection').selectedNodeIds
  let hoveredGroupId = state.read('groupHovered')
  let zoom = state.read('viewport').zoom

  const hasSubscribers = () =>
    nodeIdsListeners.size > 0 ||
    nodeItemsListeners.size > 0 ||
    nodeHandlesListeners.size > 0 ||
    nodeItemListeners.size > 0 ||
    nodeHandleListeners.size > 0

  const pullForRead = () => {
    if (hasSubscribers()) return
    syncCanvasNodesFull(readRenderContext())
  }

  const readRenderContext = (): NodeRenderContext => ({
    activeTool: state.read('tool'),
    selectedNodeIds: state.read('selection').selectedNodeIds,
    hoveredGroupId: state.read('groupHovered'),
    zoom: state.read('viewport').zoom
  })

  const markNodeItemsDirty = () => {
    nodeItemsDirty = true
    markMetricDirty(nodeItemsMetric)
  }

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
    const changedNodeIds: NodeId[] = []

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeItemsById.get(nodeId)
      if (!node) {
        if (!previous) continue
        nextById = ensureMutableMap(nodeItemsById, nextById)
        nextById.delete(nodeId)
        changedNodeIds.push(nodeId)
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
      changedNodeIds.push(nodeId)
    }

    if (!changedNodeIds.length) return false
    nodeItemsById = nextById
    markMetricRevision(nodeItemsMetric)
    markNodeItemsDirty()
    changedNodeIds.forEach((nodeId) => {
      notifyListeners(nodeItemListeners.get(nodeId))
    })
    return true
  }

  const syncNodeHandlesByIds = (targetNodeIds: Iterable<NodeId>, context?: NodeRenderContext) => {
    const resolvedContext = resolveRenderContext(context)
    const startedAt = measureNow()
    let nextById = nodeHandlesById
    const changedNodeIds: NodeId[] = []

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
        changedNodeIds.push(nodeId)
        continue
      }

      if (previous === next) continue
      nextById = ensureMutableMap(nodeHandlesById, nextById)
      nextById.set(nodeId, next)
      changedNodeIds.push(nodeId)
    }

    if (!changedNodeIds.length) {
      markMetricHit(nodeHandlesMetric)
      return false
    }
    nodeHandlesById = nextById
    markMetricRecompute(nodeHandlesMetric, measureNow() - startedAt, {
      bumpRevision: true
    })
    changedNodeIds.forEach((nodeId) => {
      notifyListeners(nodeHandleListeners.get(nodeId))
    })
    return true
  }

  const notifyNodeVisualChanges = ({
    nodeItemsChanged,
    nodeHandlesChanged
  }: NodeVisualSyncResult) => {
    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const mergeNodeVisualChanges = (
    base: NodeVisualSyncResult,
    next: NodeVisualSyncResult
  ): NodeVisualSyncResult => ({
    nodeItemsChanged: base.nodeItemsChanged || next.nodeItemsChanged,
    nodeHandlesChanged: base.nodeHandlesChanged || next.nodeHandlesChanged
  })

  const syncNodeVisualsByIds = (
    targetNodeIds: Iterable<NodeId>,
    options?: {
      context?: NodeRenderContext
      handleSync?: NodeHandleSyncMode
    }
  ): NodeVisualSyncResult => {
    const context = options?.context
    const handleSync = options?.handleSync ?? 'auto'
    const nodeItemsChanged = syncNodeItemsByIds(targetNodeIds, context)
    const shouldSyncHandles =
      handleSync === 'always' ||
      (handleSync === 'auto' && (context?.activeTool ?? activeTool) === 'select')
    const nodeHandlesChanged = shouldSyncHandles
      ? syncNodeHandlesByIds(targetNodeIds, context)
      : false
    return {
      nodeItemsChanged,
      nodeHandlesChanged
    }
  }

  const applyNodeOrder = (nextNodeIds: NodeId[]) => {
    if (isSameIdOrder(nodeIds, nextNodeIds)) return false
    nodeIds = nextNodeIds
    markMetricRevision(nodeItemsMetric)
    markNodeItemsDirty()
    notifyListeners(nodeIdsListeners)
    return true
  }

  const clearNodeHandles = () => {
    if (!nodeHandlesById.size) return false
    const startedAt = measureNow()
    const changedNodeIds = Array.from(nodeHandlesById.keys())
    nodeHandlesById = new Map()
    markMetricRecompute(nodeHandlesMetric, measureNow() - startedAt, {
      bumpRevision: true
    })
    changedNodeIds.forEach((nodeId) => {
      notifyListeners(nodeHandleListeners.get(nodeId))
    })
    return true
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

    let visualChanges: NodeVisualSyncResult = {
      nodeItemsChanged: false,
      nodeHandlesChanged: false
    }
    if (applyNodeOrder(nextNodeIds)) {
      visualChanges = {
        ...visualChanges,
        nodeItemsChanged: true
      }
    }

    if (removedNodeIds.size) {
      visualChanges = mergeNodeVisualChanges(
        visualChanges,
        syncNodeVisualsByIds(removedNodeIds, {
          context,
          handleSync: 'always'
        })
      )
    }

    if (changedNodeIds.size) {
      visualChanges = mergeNodeVisualChanges(
        visualChanges,
        syncNodeVisualsByIds(changedNodeIds, {
          context,
          handleSync: 'auto'
        })
      )
    }

    notifyNodeVisualChanges(visualChanges)
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

    notifyNodeVisualChanges(
      syncNodeVisualsByIds(changedNodeIds, {
        context,
        handleSync: 'auto'
      })
    )
  }

  const syncCanvasNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(graph.read().canvasNodes).map(
      (node) => node.id
    )
    if (!applyNodeOrder(nextNodeIds)) return
    notifyListeners(nodeItemsListeners)
  }

  const syncCanvasNodes: NodeRegistry['syncCanvasNodes'] = (options) => {
    if (!hasSubscribers()) return
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
    if (!hasSubscribers()) return

    if (key === 'selection') {
      const nextSelectedNodeIds = state.read('selection').selectedNodeIds
      if (nextSelectedNodeIds === selectedNodeIds) return

      const changedNodeIds = diffSelection(selectedNodeIds, nextSelectedNodeIds)
      selectedNodeIds = nextSelectedNodeIds
      if (!changedNodeIds.size || activeTool === 'edge') return

      notifyNodeVisualChanges(
        syncNodeVisualsByIds(changedNodeIds, {
          handleSync: 'always'
        })
      )
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
      notifyNodeVisualChanges(
        syncNodeVisualsByIds(changedNodeIds, {
          handleSync: 'never'
        })
      )
      return
    }

    if (key === 'tool') {
      const nextTool = state.read('tool')
      if (nextTool === activeTool) return

      activeTool = nextTool
      const nodeItemsChanged = syncNodeItemsByIds(nodeIds)
      const nodeHandlesChanged =
        activeTool === 'select'
          ? syncNodeHandlesByIds(selectedNodeIds)
          : clearNodeHandles()

      notifyNodeVisualChanges({
        nodeItemsChanged,
        nodeHandlesChanged
      })
      return
    }

    const nextZoom = state.read('viewport').zoom
    if (nextZoom === zoom) return

    zoom = nextZoom
    const nodeItemsChanged = syncNodeItemsByIds(nodeIds)
    const nodeHandlesChanged =
      activeTool === 'select'
        ? syncNodeHandlesByIds(selectedNodeIds)
        : false

    notifyNodeVisualChanges({
      nodeItemsChanged,
      nodeHandlesChanged
    })
  }

  const getNodeItems: NodeRegistry['getNodeItems'] = () => {
    if (!nodeItemsDirty) {
      markMetricHit(nodeItemsMetric)
      return nodeItems
    }
    const startedAt = measureNow()
    nodeItems = nodeIds
      .map((nodeId) => nodeItemsById.get(nodeId))
      .filter((item): item is NodeViewItemEntry => Boolean(item))
    nodeItemsDirty = false
    markMetricRecompute(nodeItemsMetric, measureNow() - startedAt)
    return nodeItems
  }

  return {
    syncCanvasNodes,
    syncState,
    getNodeItems,
    getNodeHandlesMap: () => {
      pullForRead()
      markMetricHit(nodeHandlesMetric)
      return nodeHandlesById
    },
    getNodeIds: () => {
      pullForRead()
      return nodeIds
    },
    watchNodeIds: (listener) => {
      pullForRead()
      return watchSet(nodeIdsListeners, listener)
    },
    watchNodeItems: (listener) => {
      pullForRead()
      return watchSet(nodeItemsListeners, listener)
    },
    getNodeItem: (nodeId) => {
      pullForRead()
      return nodeItemsById.get(nodeId)
    },
    watchNodeItem: (nodeId, listener) => {
      pullForRead()
      return watchEntity(nodeItemListeners, nodeId, listener)
    },
    watchNodeHandles: (listener) => {
      pullForRead()
      return watchSet(nodeHandlesListeners, listener)
    },
    getNodeTransformHandles: (nodeId) => {
      pullForRead()
      return nodeHandlesById.get(nodeId)
    },
    watchNodeTransformHandles: (nodeId, listener) => {
      pullForRead()
      return watchEntity(nodeHandleListeners, nodeId, listener)
    },
    getNodeItemsMetric: () => snapshotViewMetric(nodeItemsMetric),
    getNodeHandlesMetric: () => snapshotViewMetric(nodeHandlesMetric),
    resetNodeItemsMetric: () => {
      nodeItemsMetric = createViewMetric()
    },
    resetNodeHandlesMetric: () => {
      nodeHandlesMetric = createViewMetric()
    }
  }
}
