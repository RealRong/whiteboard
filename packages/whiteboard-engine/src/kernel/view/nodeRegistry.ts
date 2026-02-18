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
import { DEFAULT_TUNING } from '../../config'
import { buildTransformHandles } from '../../node/utils/transform'
import { toLayerOrderedCanvasNodes } from '../query'
import {
  createViewMetric,
  markMetricDirty,
  markMetricHit,
  markMetricRecompute,
  markMetricRevision,
  measureNow,
  snapshotViewMetric
} from './metrics'
import {
  notifyListeners,
  watchEntity,
  watchSet,
  isSameIdOrder
} from './shared'

type NodeViewItemEntry = ViewSnapshot['node.items'][number]
type NodeHandleEntry = ViewSnapshot['node.transformHandles'] extends Map<
  NodeId,
  infer TValue
>
  ? TValue
  : never
type NodeItemsViewValue = ViewSnapshot['node.items']
type NodeRenderContext = {
  activeTool: 'select' | 'edge'
  selectedNodeIds: Set<NodeId>
  hoveredGroupId: NodeId | undefined
  zoom: number
}
type SyncCanvasNodesOptions = {
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
  fullSync?: boolean
}

type Options = {
  state: State
  query: Query
  graph: GraphProjector
}

export type NodeRegistry = {
  syncCanvasNodes: (options?: SyncCanvasNodesOptions) => void
  syncSelectionState: () => void
  syncGroupHoveredState: () => void
  syncToolState: () => void
  syncViewportState: () => void
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

const isSameHandleList = (
  left: NodeHandleEntry | undefined,
  right: NodeHandleEntry
) => {
  if (!left) return false
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const leftHandle = left[index]
    const rightHandle = right[index]
    if (
      leftHandle.id !== rightHandle.id ||
      leftHandle.kind !== rightHandle.kind ||
      leftHandle.direction !== rightHandle.direction ||
      leftHandle.cursor !== rightHandle.cursor ||
      leftHandle.position.x !== rightHandle.position.x ||
      leftHandle.position.y !== rightHandle.position.y
    ) {
      return false
    }
  }
  return true
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

  const getNodeRect = (node: Node) =>
    query.canvas.nodeRect(node.id)?.rect ?? {
      x: node.position.x,
      y: node.position.y,
      width: node.size?.width ?? 0,
      height: node.size?.height ?? 0
    }

  const toNodeItem = (node: Node, context?: NodeRenderContext): NodeViewItemEntry => {
    const nextTool = context?.activeTool ?? activeTool
    const nextSelectedNodeIds = context?.selectedNodeIds ?? selectedNodeIds
    const nextHoveredGroupId = context?.hoveredGroupId ?? hoveredGroupId
    const nextZoom = context?.zoom ?? zoom
    const rect = getNodeRect(node)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const transformBase = `translate(${rect.x}px, ${rect.y}px)`
    const selected = nextTool === 'edge' ? false : nextSelectedNodeIds.has(node.id)
    const hovered = nextHoveredGroupId === node.id
    const previous = nodeItemsById.get(node.id)

    if (
      previous &&
      previous.node === node &&
      previous.rect === rect &&
      previous.container.rotation === rotation &&
      previous.container.transformBase === transformBase &&
      previous.selected === selected &&
      previous.hovered === hovered &&
      previous.activeTool === nextTool &&
      previous.zoom === nextZoom
    ) {
      return previous
    }

    return {
      node,
      rect,
      container: {
        transformBase,
        rotation,
        transformOrigin: 'center center'
      },
      selected,
      hovered,
      activeTool: nextTool,
      zoom: nextZoom
    }
  }

  const toNodeHandles = (node: Node, context?: NodeRenderContext): NodeHandleEntry | undefined => {
    const nextTool = context?.activeTool ?? activeTool
    const nextSelectedNodeIds = context?.selectedNodeIds ?? selectedNodeIds
    const nextZoom = context?.zoom ?? zoom

    if (nextTool !== 'select') return undefined
    if (!nextSelectedNodeIds.has(node.id) || node.locked) return undefined

    const previous = nodeHandlesById.get(node.id)
    const rect = getNodeRect(node)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const next = buildTransformHandles({
      rect,
      rotation,
      canRotate: true,
      rotateHandleOffset: DEFAULT_TUNING.nodeTransform.rotateHandleOffset,
      zoom: nextZoom
    })
    if (isSameHandleList(previous, next)) {
      return previous
    }
    return next
  }

  const syncNodeItemsByIds = (targetNodeIds: Iterable<NodeId>, context?: NodeRenderContext) => {
    let nextById = nodeItemsById
    const changedNodeIds: NodeId[] = []

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeItemsById.get(nodeId)
      if (!node) {
        if (!previous) continue
        if (nextById === nodeItemsById) {
          nextById = new Map(nodeItemsById)
        }
        nextById.delete(nodeId)
        changedNodeIds.push(nodeId)
        continue
      }

      const next = toNodeItem(node, context)
      if (previous === next) continue
      if (nextById === nodeItemsById) {
        nextById = new Map(nodeItemsById)
      }
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
    const startedAt = measureNow()
    let nextById = nodeHandlesById
    const changedNodeIds: NodeId[] = []

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeHandlesById.get(nodeId)
      const next = node ? toNodeHandles(node, context) : undefined

      if (!next) {
        if (!previous) continue
        if (nextById === nodeHandlesById) {
          nextById = new Map(nodeHandlesById)
        }
        nextById.delete(nodeId)
        changedNodeIds.push(nodeId)
        continue
      }

      if (previous === next) continue
      if (nextById === nodeHandlesById) {
        nextById = new Map(nodeHandlesById)
      }
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

    let nodeItemsChanged = false
    let nodeHandlesChanged = false
    const nodeOrderChanged = !isSameIdOrder(nodeIds, nextNodeIds)
    if (nodeOrderChanged) {
      nodeIds = nextNodeIds
      markMetricRevision(nodeItemsMetric)
      markNodeItemsDirty()
      notifyListeners(nodeIdsListeners)
      nodeItemsChanged = true
    }

    if (removedNodeIds.size) {
      nodeItemsChanged = syncNodeItemsByIds(removedNodeIds, context) || nodeItemsChanged
      nodeHandlesChanged =
        syncNodeHandlesByIds(removedNodeIds, context) || nodeHandlesChanged
    }

    if (changedNodeIds.size) {
      nodeItemsChanged = syncNodeItemsByIds(changedNodeIds, context) || nodeItemsChanged
      if ((context?.activeTool ?? activeTool) === 'select') {
        nodeHandlesChanged =
          syncNodeHandlesByIds(changedNodeIds, context) || nodeHandlesChanged
      }
    }

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
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
        if (nextById === canvasNodeById) {
          nextById = new Map(canvasNodeById)
        }
        nextById.set(nodeId, next)
        changedNodeIds.add(nodeId)
        return
      }

      if (previous && !next) {
        if (nextById === canvasNodeById) {
          nextById = new Map(canvasNodeById)
        }
        nextById.delete(nodeId)
        changedNodeIds.add(nodeId)
        return
      }

      if (previous === next || !next) return
      if (nextById === canvasNodeById) {
        nextById = new Map(canvasNodeById)
      }
      nextById.set(nodeId, next)
      changedNodeIds.add(nodeId)
    })

    if (nextById !== canvasNodeById) {
      canvasNodeById = nextById
    }
    if (!changedNodeIds.size) return

    const nodeItemsChanged = syncNodeItemsByIds(changedNodeIds, context)
    const nodeHandlesChanged =
      (context?.activeTool ?? activeTool) === 'select'
        ? syncNodeHandlesByIds(changedNodeIds, context)
        : false

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const syncCanvasNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(graph.read().canvasNodes).map(
      (node) => node.id
    )
    if (isSameIdOrder(nodeIds, nextNodeIds)) return
    nodeIds = nextNodeIds
    markMetricRevision(nodeItemsMetric)
    markNodeItemsDirty()
    notifyListeners(nodeIdsListeners)
    notifyListeners(nodeItemsListeners)
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

  const syncSelectionState: NodeRegistry['syncSelectionState'] = () => {
    const nextSelectedNodeIds = state.read('selection').selectedNodeIds
    if (nextSelectedNodeIds === selectedNodeIds) return

    const changedNodeIds = diffSelection(selectedNodeIds, nextSelectedNodeIds)
    selectedNodeIds = nextSelectedNodeIds
    if (!changedNodeIds.size || activeTool === 'edge') return

    const nodeItemsChanged = syncNodeItemsByIds(changedNodeIds)
    const nodeHandlesChanged = syncNodeHandlesByIds(changedNodeIds)
    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const syncGroupHoveredState: NodeRegistry['syncGroupHoveredState'] = () => {
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
    if (syncNodeItemsByIds(changedNodeIds)) {
      notifyListeners(nodeItemsListeners)
    }
  }

  const syncToolState: NodeRegistry['syncToolState'] = () => {
    const nextTool = state.read('tool')
    if (nextTool === activeTool) return

    activeTool = nextTool
    const nodeItemsChanged = syncNodeItemsByIds(nodeIds)
    const nodeHandlesChanged =
      activeTool === 'select'
        ? syncNodeHandlesByIds(selectedNodeIds)
        : clearNodeHandles()

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const syncViewportState: NodeRegistry['syncViewportState'] = () => {
    const nextZoom = state.read('viewport').zoom
    if (nextZoom === zoom) return

    zoom = nextZoom
    const nodeItemsChanged = syncNodeItemsByIds(nodeIds)
    const nodeHandlesChanged =
      activeTool === 'select'
        ? syncNodeHandlesByIds(selectedNodeIds)
        : false

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
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
    syncSelectionState,
    syncGroupHoveredState,
    syncToolState,
    syncViewportState,
    getNodeItems,
    getNodeHandlesMap: () => {
      markMetricHit(nodeHandlesMetric)
      return nodeHandlesById
    },
    getNodeIds: () => nodeIds,
    watchNodeIds: (listener) => watchSet(nodeIdsListeners, listener),
    watchNodeItems: (listener) => watchSet(nodeItemsListeners, listener),
    getNodeItem: (nodeId) => nodeItemsById.get(nodeId),
    watchNodeItem: (nodeId, listener) =>
      watchEntity(nodeItemListeners, nodeId, listener),
    watchNodeHandles: (listener) => watchSet(nodeHandlesListeners, listener),
    getNodeTransformHandles: (nodeId) => nodeHandlesById.get(nodeId),
    watchNodeTransformHandles: (nodeId, listener) =>
      watchEntity(nodeHandleListeners, nodeId, listener),
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
