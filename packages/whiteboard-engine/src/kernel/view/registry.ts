import type {
  InstanceConfig,
  Query,
  StateKey,
  State,
  EdgePathEntry,
  ViewKey,
  ViewDebugMetric,
  ViewDebugSnapshot,
  View,
  ViewSnapshot
} from '@engine-types/instance'
import type { EdgeId, Node, NodeId } from '@whiteboard/core'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { buildTransformHandles } from '../../node/utils/transform'
import { createDerivedRegistry } from '../derive'
import { createViewDerivations, VIEW_KEYS } from './derivations'
import { toLayerOrderedCanvasNodes } from '../query'
import type { CanvasNodes } from '../projector/canvas'

type Options = {
  state: State
  canvas: CanvasNodes
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

const PROJECTOR_KEYS = new Set<ViewKey>([
  'edge.entries',
  'edge.paths',
  'edge.reconnect',
  'mindmap.roots',
  'mindmap.trees'
])

type Listener = () => void
type NodeViewItemEntry = ViewSnapshot['node.items'][number]
type NodeHandleEntry = ViewSnapshot['node.transformHandles'] extends Map<
  NodeId,
  infer TValue
>
  ? TValue
  : never
type EdgePathViewEntry = ViewSnapshot['edge.paths'][number]
type MindmapTreeViewEntry = ViewSnapshot['mindmap.trees'][number]
type NodeItemsViewValue = ViewSnapshot['node.items']

const ROTATE_HANDLE_OFFSET = 24

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const createViewMetric = (): ViewDebugMetric => ({
  revision: 0,
  dirty: false,
  recomputeCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  cacheHitRate: 1,
  lastComputeMs: 0,
  avgComputeMs: 0,
  maxComputeMs: 0,
  totalComputeMs: 0,
  lastComputedAt: undefined
})

const updateHitRate = (metric: ViewDebugMetric) => {
  const totalReads = metric.cacheHitCount + metric.cacheMissCount
  metric.cacheHitRate = totalReads > 0 ? metric.cacheHitCount / totalReads : 1
}

const markMetricHit = (metric: ViewDebugMetric) => {
  metric.cacheHitCount += 1
  updateHitRate(metric)
}

const markMetricDirty = (metric: ViewDebugMetric) => {
  metric.dirty = true
}

const markMetricRevision = (metric: ViewDebugMetric) => {
  metric.revision += 1
}

const markMetricRecompute = (
  metric: ViewDebugMetric,
  elapsedMs: number,
  options?: { bumpRevision?: boolean }
) => {
  metric.recomputeCount += 1
  metric.cacheMissCount += 1
  metric.totalComputeMs += elapsedMs
  metric.lastComputeMs = elapsedMs
  metric.maxComputeMs = Math.max(metric.maxComputeMs, elapsedMs)
  metric.avgComputeMs =
    metric.recomputeCount > 0 ? metric.totalComputeMs / metric.recomputeCount : 0
  metric.lastComputedAt = Date.now()
  metric.dirty = false
  if (options?.bumpRevision) {
    markMetricRevision(metric)
  }
  updateHitRate(metric)
}

const snapshotViewMetric = (metric: ViewDebugMetric): ViewDebugMetric => ({
  ...metric
})

const isSameIdOrder = <TId extends string>(left: readonly TId[], right: readonly TId[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const notifyListeners = (listeners?: Set<Listener>) => {
  if (!listeners?.size) return
  listeners.forEach((listener) => listener())
}

const watchSet = (listeners: Set<Listener>, listener: Listener) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const watchEntity = <TId extends string>(
  map: Map<TId, Set<Listener>>,
  id: TId,
  listener: Listener
) => {
  const listeners = map.get(id) ?? new Set<Listener>()
  listeners.add(listener)
  map.set(id, listeners)
  return () => {
    const current = map.get(id)
    if (!current) return
    current.delete(listener)
    if (!current.size) {
      map.delete(id)
    }
  }
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

export const createViewRegistry = ({
  state,
  canvas,
  query,
  config,
  platform
}: Options): View => {
  const resolvers = createViewDerivations({
    readState: state.read,
    query,
    config,
    platform
  })
  const derived = createDerivedRegistry<ViewKey, StateKey, ViewSnapshot>({
    keys: VIEW_KEYS,
    resolvers,
    watchDependency: state.watch,
    project: (keys, read) => {
      keys.forEach((key) => {
        if (!PROJECTOR_KEYS.has(key)) return
        read(key)
      })
    }
  })

  const nodeIdsListeners = new Set<Listener>()
  const nodeItemsListeners = new Set<Listener>()
  const nodeHandlesListeners = new Set<Listener>()
  const edgeIdsListeners = new Set<Listener>()
  const mindmapTreeIdsListeners = new Set<Listener>()
  const nodeItemListeners = new Map<NodeId, Set<Listener>>()
  const nodeHandleListeners = new Map<NodeId, Set<Listener>>()
  const edgePathListeners = new Map<EdgeId, Set<Listener>>()
  const mindmapTreeListeners = new Map<NodeId, Set<Listener>>()

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
  let edgeIds: EdgeId[] = []
  let edgePathsById = new Map<EdgeId, EdgePathViewEntry>()
  let mindmapTreeIds: NodeId[] = []
  let mindmapTreesById = new Map<NodeId, MindmapTreeViewEntry>()

  const markNodeItemsDirty = () => {
    nodeItemsDirty = true
    markMetricDirty(nodeItemsMetric)
  }

  const getNodeRect = (node: Node) =>
    query.getNodeRectById(node.id)?.rect ?? {
      x: node.position.x,
      y: node.position.y,
      width: node.size?.width ?? 0,
      height: node.size?.height ?? 0
    }

  const toNodeItem = (node: Node): NodeViewItemEntry => {
    const rect = getNodeRect(node)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const transformBase = `translate(${rect.x}px, ${rect.y}px)`
    const selected = activeTool === 'edge' ? false : selectedNodeIds.has(node.id)
    const hovered = hoveredGroupId === node.id
    const previous = nodeItemsById.get(node.id)

    if (
      previous &&
      previous.node === node &&
      previous.rect === rect &&
      previous.container.rotation === rotation &&
      previous.container.transformBase === transformBase &&
      previous.selected === selected &&
      previous.hovered === hovered &&
      previous.activeTool === activeTool &&
      previous.zoom === zoom
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
      activeTool,
      zoom
    }
  }

  const toNodeHandles = (node: Node): NodeHandleEntry | undefined => {
    if (activeTool !== 'select') return undefined
    if (!selectedNodeIds.has(node.id) || node.locked) return undefined

    const previous = nodeHandlesById.get(node.id)
    const rect = getNodeRect(node)
    const rotation = typeof node.rotation === 'number' ? node.rotation : 0
    const next = buildTransformHandles({
      rect,
      rotation,
      canRotate: true,
      rotateHandleOffset: ROTATE_HANDLE_OFFSET,
      zoom
    })
    if (isSameHandleList(previous, next)) {
      return previous
    }
    return next
  }

  const syncNodeItemsByIds = (targetNodeIds: Iterable<NodeId>) => {
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

      const next = toNodeItem(node)
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

  const syncNodeHandlesByIds = (targetNodeIds: Iterable<NodeId>) => {
    const startedAt = now()
    let nextById = nodeHandlesById
    const changedNodeIds: NodeId[] = []

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = nodeHandlesById.get(nodeId)
      const next = node ? toNodeHandles(node) : undefined

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
    markMetricRecompute(nodeHandlesMetric, now() - startedAt, {
      bumpRevision: true
    })
    changedNodeIds.forEach((nodeId) => {
      notifyListeners(nodeHandleListeners.get(nodeId))
    })
    return true
  }

  const clearNodeHandles = () => {
    if (!nodeHandlesById.size) return false
    const startedAt = now()
    const changedNodeIds = Array.from(nodeHandlesById.keys())
    nodeHandlesById = new Map()
    markMetricRecompute(nodeHandlesMetric, now() - startedAt, {
      bumpRevision: true
    })
    changedNodeIds.forEach((nodeId) => {
      notifyListeners(nodeHandleListeners.get(nodeId))
    })
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

  const syncCanvasNodesFull = () => {
    const orderedNodes = toLayerOrderedCanvasNodes(state.read('canvasNodes'))
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
      nodeItemsChanged =
        syncNodeItemsByIds(removedNodeIds) || nodeItemsChanged
      nodeHandlesChanged =
        syncNodeHandlesByIds(removedNodeIds) || nodeHandlesChanged
    }

    if (changedNodeIds.size) {
      nodeItemsChanged =
        syncNodeItemsByIds(changedNodeIds) || nodeItemsChanged
      if (activeTool === 'select') {
        nodeHandlesChanged =
          syncNodeHandlesByIds(changedNodeIds) || nodeHandlesChanged
      }
    }

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const syncCanvasNodesDirty = (dirtyNodeIds: NodeId[]) => {
    const dirtySet = new Set(dirtyNodeIds)
    if (!dirtySet.size) return

    let nextById = canvasNodeById
    const changedNodeIds = new Set<NodeId>()

    dirtySet.forEach((nodeId) => {
      const previous = canvasNodeById.get(nodeId)
      const next = canvas.readById(nodeId)
      if (!previous && !next) {
        return
      }
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
      if (previous === next) return
      if (!next) return
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

    const nodeItemsChanged = syncNodeItemsByIds(changedNodeIds)
    const nodeHandlesChanged =
      activeTool === 'select'
        ? syncNodeHandlesByIds(changedNodeIds)
        : false

    if (nodeItemsChanged) {
      notifyListeners(nodeItemsListeners)
    }
    if (nodeHandlesChanged) {
      notifyListeners(nodeHandlesListeners)
    }
  }

  const syncCanvasNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(state.read('canvasNodes')).map(
      (node) => node.id
    )
    if (isSameIdOrder(nodeIds, nextNodeIds)) return
    nodeIds = nextNodeIds
    markMetricRevision(nodeItemsMetric)
    markNodeItemsDirty()
    notifyListeners(nodeIdsListeners)
    notifyListeners(nodeItemsListeners)
  }

  const syncCanvasNodes = (options?: {
    dirtyNodeIds?: NodeId[]
    orderChanged?: boolean
    fullSync?: boolean
  }) => {
    const dirtyNodeIds = options?.dirtyNodeIds
    const orderChanged = options?.orderChanged
    const fullSync = options?.fullSync

    if (fullSync) {
      syncCanvasNodesFull()
      return
    }

    if (dirtyNodeIds?.length) {
      syncCanvasNodesDirty(dirtyNodeIds)
      if (orderChanged) {
        syncCanvasNodeOrder()
      }
      return
    }
    if (orderChanged) {
      syncCanvasNodeOrder()
      return
    }
    syncCanvasNodesFull()
  }

  const syncSelectionState = () => {
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

  const syncGroupHoveredState = () => {
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

  const syncToolState = () => {
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

  const syncViewportState = () => {
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

  const getNodeItems = () => {
    if (!nodeItemsDirty) {
      markMetricHit(nodeItemsMetric)
      return nodeItems
    }
    const startedAt = now()
    nodeItems = nodeIds
      .map((nodeId) => nodeItemsById.get(nodeId))
      .filter((item): item is NodeViewItemEntry => Boolean(item))
    nodeItemsDirty = false
    markMetricRecompute(nodeItemsMetric, now() - startedAt)
    return nodeItems
  }

  const syncEdgePaths = () => {
    const paths = derived.read('edge.paths')
    const nextIds = paths.map((entry) => entry.id)
    const nextById = new Map<EdgeId, EdgePathViewEntry>()
    paths.forEach((entry) => {
      nextById.set(entry.id, entry)
    })

    const changedIds = new Set<EdgeId>()
    nextById.forEach((entry, edgeId) => {
      if (edgePathsById.get(edgeId) !== entry) {
        changedIds.add(edgeId)
      }
    })
    edgePathsById.forEach((_, edgeId) => {
      if (!nextById.has(edgeId)) {
        changedIds.add(edgeId)
      }
    })

    const edgeOrderChanged = !isSameIdOrder(edgeIds, nextIds)
    if (edgeOrderChanged) {
      edgeIds = nextIds
      notifyListeners(edgeIdsListeners)
    }
    edgePathsById = nextById

    changedIds.forEach((edgeId) => {
      notifyListeners(edgePathListeners.get(edgeId))
    })
  }

  const syncMindmapTrees = () => {
    const trees = derived.read('mindmap.trees')
    const nextIds = trees.map((tree) => tree.id)
    const nextById = new Map<NodeId, MindmapTreeViewEntry>()
    trees.forEach((tree) => {
      nextById.set(tree.id, tree)
    })

    const changedIds = new Set<NodeId>()
    nextById.forEach((tree, treeId) => {
      if (mindmapTreesById.get(treeId) !== tree) {
        changedIds.add(treeId)
      }
    })
    mindmapTreesById.forEach((_, treeId) => {
      if (!nextById.has(treeId)) {
        changedIds.add(treeId)
      }
    })

    const treeOrderChanged = !isSameIdOrder(mindmapTreeIds, nextIds)
    if (treeOrderChanged) {
      mindmapTreeIds = nextIds
      notifyListeners(mindmapTreeIdsListeners)
    }
    mindmapTreesById = nextById

    changedIds.forEach((treeId) => {
      notifyListeners(mindmapTreeListeners.get(treeId))
    })
  }

  canvas.watch(({ dirtyNodeIds, orderChanged, fullSync }) =>
    syncCanvasNodes({ dirtyNodeIds, orderChanged, fullSync })
  )
  state.watch('selection', syncSelectionState)
  state.watch('groupHovered', syncGroupHoveredState)
  state.watch('tool', syncToolState)
  state.watch('viewport', syncViewportState)
  derived.watch('edge.paths', syncEdgePaths)
  derived.watch('mindmap.trees', syncMindmapTrees)

  syncCanvasNodes()
  syncEdgePaths()
  syncMindmapTrees()

  const read: View['read'] = (key) => {
    if (key === 'node.items') {
      return getNodeItems() as ViewSnapshot[typeof key]
    }
    if (key === 'node.transformHandles') {
      markMetricHit(nodeHandlesMetric)
      return nodeHandlesById as ViewSnapshot[typeof key]
    }
    return derived.read(key)
  }

  const watch: View['watch'] = (key, listener) => {
    if (key === 'node.items') {
      return watchSet(nodeItemsListeners, listener)
    }
    if (key === 'node.transformHandles') {
      return watchSet(nodeHandlesListeners, listener)
    }
    return derived.watch(key, listener)
  }

  const snapshot: View['snapshot'] = () =>
    Object.fromEntries(VIEW_KEYS.map((key) => [key, read(key)])) as ViewSnapshot

  const getMetrics: View['debug']['getMetrics'] = (key) => {
    if (key === 'node.items') {
      return snapshotViewMetric(nodeItemsMetric)
    }
    if (key === 'node.transformHandles') {
      return snapshotViewMetric(nodeHandlesMetric)
    }
    return derived.debug.getMetric(key)
  }

  const getAllMetrics: View['debug']['getAllMetrics'] = () => {
    const metrics = derived.debug.getAllMetrics() as ViewDebugSnapshot
    metrics['node.items'] = snapshotViewMetric(nodeItemsMetric)
    metrics['node.transformHandles'] = snapshotViewMetric(nodeHandlesMetric)
    return metrics
  }

  const resetMetrics: View['debug']['resetMetrics'] = (key) => {
    if (key === 'node.items') {
      nodeItemsMetric = createViewMetric()
      return
    }
    if (key === 'node.transformHandles') {
      nodeHandlesMetric = createViewMetric()
      return
    }
    if (key) {
      derived.debug.resetMetrics(key)
      return
    }
    nodeItemsMetric = createViewMetric()
    nodeHandlesMetric = createViewMetric()
    derived.debug.resetMetrics()
  }

  return {
    read,
    watch,
    snapshot,
    getNodeIds: () => nodeIds,
    watchNodeIds: (listener) => {
      nodeIdsListeners.add(listener)
      return () => {
        nodeIdsListeners.delete(listener)
      }
    },
    getNodeItem: (nodeId) => nodeItemsById.get(nodeId),
    watchNodeItem: (nodeId, listener) =>
      watchEntity(nodeItemListeners, nodeId, listener),
    getNodeTransformHandles: (nodeId) => nodeHandlesById.get(nodeId),
    watchNodeTransformHandles: (nodeId, listener) =>
      watchEntity(nodeHandleListeners, nodeId, listener),
    getEdgeIds: () => edgeIds,
    watchEdgeIds: (listener) => {
      edgeIdsListeners.add(listener)
      return () => {
        edgeIdsListeners.delete(listener)
      }
    },
    getEdgePath: (edgeId) => edgePathsById.get(edgeId) as EdgePathEntry | undefined,
    watchEdgePath: (edgeId, listener) =>
      watchEntity(edgePathListeners, edgeId, listener),
    getMindmapTreeIds: () => mindmapTreeIds,
    watchMindmapTreeIds: (listener) => {
      mindmapTreeIdsListeners.add(listener)
      return () => {
        mindmapTreeIdsListeners.delete(listener)
      }
    },
    getMindmapTree: (treeId) => mindmapTreesById.get(treeId),
    watchMindmapTree: (treeId, listener) =>
      watchEntity(mindmapTreeListeners, treeId, listener),
    debug: {
      getMetrics,
      getAllMetrics,
      resetMetrics
    }
  }
}
