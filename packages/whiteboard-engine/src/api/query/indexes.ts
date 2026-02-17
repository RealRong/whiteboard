import type { Node, NodeId, Rect } from '@whiteboard/core'
import type {
  CanvasNodeRect,
  InstanceConfig,
  QueryDebugMetric,
  QueryDebugSnapshot
} from '@engine-types/instance'
import type { SnapCandidate } from '@engine-types/node/snap'
import { toNodeStateSignature, toRectSignature } from '../../kernel/cache'
import { getNodeAABB, getNodeRect } from '../../kernel/geometry'

const now = () =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()

const createMetrics = (): QueryDebugMetric => ({
  rebuildCount: 0,
  cacheHitCount: 0,
  cacheMissCount: 0,
  cacheHitRate: 1,
  lastRebuildMs: 0,
  avgRebuildMs: 0,
  maxRebuildMs: 0,
  totalRebuildMs: 0,
  lastRebuiltAt: undefined
})

const updateHitRate = (metrics: QueryDebugMetric) => {
  const total = metrics.cacheHitCount + metrics.cacheMissCount
  metrics.cacheHitRate = total > 0 ? metrics.cacheHitCount / total : 1
}

const markReadHit = (metrics: QueryDebugMetric) => {
  metrics.cacheHitCount += 1
  updateHitRate(metrics)
}

const markRebuild = (metrics: QueryDebugMetric, elapsedMs: number) => {
  metrics.rebuildCount += 1
  metrics.cacheMissCount += 1
  metrics.lastRebuildMs = elapsedMs
  metrics.totalRebuildMs += elapsedMs
  metrics.maxRebuildMs = Math.max(metrics.maxRebuildMs, elapsedMs)
  metrics.avgRebuildMs = metrics.rebuildCount > 0 ? metrics.totalRebuildMs / metrics.rebuildCount : 0
  metrics.lastRebuiltAt = Date.now()
  updateHitRate(metrics)
}

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

type NodeRectCacheEntry = {
  signature: string
  entry: CanvasNodeRect
}

class NodeRectIndex {
  private byId = new Map<NodeId, NodeRectCacheEntry>()
  private orderedIds: NodeId[] = []
  private orderedEntries: CanvasNodeRect[] = []
  private orderDirty = true

  constructor(private config: InstanceConfig) {}

  private toEntry = (node: Node): CanvasNodeRect => ({
    node,
    rect: getNodeRect(node, this.config.nodeSize),
    aabb: getNodeAABB(node, this.config.nodeSize),
    rotation: typeof node.rotation === 'number' ? node.rotation : 0
  })

  private removeOrderedId = (nodeId: NodeId) => {
    const index = this.orderedIds.indexOf(nodeId)
    if (index < 0) return false
    this.orderedIds = [
      ...this.orderedIds.slice(0, index),
      ...this.orderedIds.slice(index + 1)
    ]
    return true
  }

  updateFull = (nodes: Node[]): { changed: boolean; changedNodeIds: Set<NodeId> } => {
    const seen = new Set<NodeId>()
    const nextOrderedIds: NodeId[] = []
    const changedNodeIds = new Set<NodeId>()
    let changed = false

    nodes.forEach((node) => {
      seen.add(node.id)
      nextOrderedIds.push(node.id)

      const signature = toNodeStateSignature(node, this.config.nodeSize)
      const current = this.byId.get(node.id)
      if (current && current.signature === signature) {
        return
      }

      this.byId.set(node.id, {
        signature,
        entry: this.toEntry(node)
      })
      changedNodeIds.add(node.id)
      this.orderDirty = true
      changed = true
    })

    this.byId.forEach((_, nodeId) => {
      if (seen.has(nodeId)) return
      this.byId.delete(nodeId)
      changedNodeIds.add(nodeId)
      this.orderDirty = true
      changed = true
    })

    if (!isSameIdOrder(this.orderedIds, nextOrderedIds)) {
      this.orderedIds = nextOrderedIds
      this.orderDirty = true
      changed = true
    }

    return {
      changed,
      changedNodeIds
    }
  }

  updateDirty = (
    nodeIds: NodeId[],
    getNodeById: (nodeId: NodeId) => Node | undefined
  ): {
    changed: boolean
    changedNodeIds: Set<NodeId>
    requiresFullSync: boolean
  } => {
    if (!nodeIds.length) {
      return {
        changed: false,
        changedNodeIds: new Set<NodeId>(),
        requiresFullSync: false
      }
    }

    const changedNodeIds = new Set<NodeId>()
    let changed = false
    let requiresFullSync = false

    nodeIds.forEach((nodeId) => {
      const nextNode = getNodeById(nodeId)
      const current = this.byId.get(nodeId)
      if (!nextNode) {
        if (!current) return
        this.byId.delete(nodeId)
        changedNodeIds.add(nodeId)
        changed = true
        this.orderDirty = true
        this.removeOrderedId(nodeId)
        return
      }
      const signature = toNodeStateSignature(nextNode, this.config.nodeSize)

      if (!current) {
        this.byId.set(nodeId, {
          signature,
          entry: this.toEntry(nextNode)
        })
        changedNodeIds.add(nodeId)
        changed = true
        this.orderDirty = true
        return
      }

      if (current.signature === signature) {
        return
      }

      this.byId.set(nodeId, {
        signature,
        entry: this.toEntry(nextNode)
      })
      changedNodeIds.add(nodeId)
      changed = true
      this.orderDirty = true
    })

    return {
      changed,
      changedNodeIds,
      requiresFullSync
    }
  }

  syncOrder = (orderedNodeIds: NodeId[]): boolean => {
    if (isSameIdOrder(this.orderedIds, orderedNodeIds)) {
      return false
    }
    this.orderedIds = orderedNodeIds
    this.orderDirty = true
    return true
  }

  getAll = (): CanvasNodeRect[] => {
    if (!this.orderDirty) return this.orderedEntries
    this.orderedEntries = this.orderedIds
      .map((id) => this.byId.get(id)?.entry)
      .filter((entry): entry is CanvasNodeRect => Boolean(entry))
    this.orderDirty = false
    return this.orderedEntries
  }

  getById = (nodeId: NodeId): CanvasNodeRect | undefined =>
    this.byId.get(nodeId)?.entry
}

type SnapCacheEntry = {
  signature: string
  candidate: SnapCandidate
  cellKeys: string[]
}

const keyForCell = (cx: number, cy: number) => `${cx},${cy}`

const getCellRange = (rect: Rect, cellSize: number) => {
  const minX = Math.floor(rect.x / cellSize)
  const maxX = Math.floor((rect.x + rect.width) / cellSize)
  const minY = Math.floor(rect.y / cellSize)
  const maxY = Math.floor((rect.y + rect.height) / cellSize)
  return { minX, maxX, minY, maxY }
}

const toCellKeys = (rect: Rect, cellSize: number) => {
  const { minX, maxX, minY, maxY } = getCellRange(rect, cellSize)
  const keys: string[] = []
  for (let cx = minX; cx <= maxX; cx += 1) {
    for (let cy = minY; cy <= maxY; cy += 1) {
      keys.push(keyForCell(cx, cy))
    }
  }
  return keys
}

class SnapIndex {
  private byId = new Map<NodeId, SnapCacheEntry>()
  private buckets = new Map<string, Set<NodeId>>()
  private orderedIds: NodeId[] = []
  private orderedCandidates: SnapCandidate[] = []
  private orderDirty = true
  private cellSize: number

  constructor(private getCellSize: () => number) {
    this.cellSize = getCellSize()
  }

  private toCandidate = (nodeId: NodeId, rect: Rect): SnapCandidate => ({
    id: nodeId,
    rect,
    lines: {
      left: rect.x,
      right: rect.x + rect.width,
      centerX: rect.x + rect.width / 2,
      top: rect.y,
      bottom: rect.y + rect.height,
      centerY: rect.y + rect.height / 2
    }
  })

  private removeFromBuckets = (nodeId: NodeId, cellKeys: string[]) => {
    cellKeys.forEach((cellKey) => {
      const bucket = this.buckets.get(cellKey)
      if (!bucket) return
      bucket.delete(nodeId)
      if (!bucket.size) {
        this.buckets.delete(cellKey)
      }
    })
  }

  private addToBuckets = (nodeId: NodeId, cellKeys: string[]) => {
    cellKeys.forEach((cellKey) => {
      const bucket = this.buckets.get(cellKey) ?? new Set<NodeId>()
      bucket.add(nodeId)
      this.buckets.set(cellKey, bucket)
    })
  }

  private rebuildAll = (entries: CanvasNodeRect[]) => {
    this.byId.clear()
    this.buckets.clear()

    entries.forEach((entry) => {
      const candidate = this.toCandidate(entry.node.id, entry.aabb)
      const cellKeys = toCellKeys(candidate.rect, this.cellSize)
      this.addToBuckets(entry.node.id, cellKeys)
      this.byId.set(entry.node.id, {
        signature: toRectSignature(entry.aabb),
        candidate,
        cellKeys
      })
    })

    this.orderedIds = entries.map((entry) => entry.node.id)
    this.orderDirty = true
  }

  update = (entries: CanvasNodeRect[]): boolean => {
    const nextCellSize = this.getCellSize()
    if (nextCellSize !== this.cellSize) {
      this.cellSize = nextCellSize
      this.rebuildAll(entries)
      return true
    }

    const seen = new Set<NodeId>()
    const nextOrderedIds: NodeId[] = []
    let changed = false

    entries.forEach((entry) => {
      const nodeId = entry.node.id
      seen.add(nodeId)
      nextOrderedIds.push(nodeId)

      const signature = toRectSignature(entry.aabb)
      const current = this.byId.get(nodeId)
      if (current && current.signature === signature) {
        return
      }

      const candidate = this.toCandidate(nodeId, entry.aabb)
      const cellKeys = toCellKeys(candidate.rect, this.cellSize)
      if (current) {
        this.removeFromBuckets(nodeId, current.cellKeys)
      }
      this.addToBuckets(nodeId, cellKeys)
      this.byId.set(nodeId, {
        signature,
        candidate,
        cellKeys
      })
      this.orderDirty = true
      changed = true
    })

    this.byId.forEach((entry, nodeId) => {
      if (seen.has(nodeId)) return
      this.removeFromBuckets(nodeId, entry.cellKeys)
      this.byId.delete(nodeId)
      this.orderDirty = true
      changed = true
    })

    if (!isSameIdOrder(this.orderedIds, nextOrderedIds)) {
      this.orderedIds = nextOrderedIds
      this.orderDirty = true
      changed = true
    }

    return changed
  }

  updateDirty = (
    nodeIds: NodeId[],
    getEntryById: (nodeId: NodeId) => CanvasNodeRect | undefined
  ): {
    changed: boolean
    requiresFullSync: boolean
  } => {
    if (!nodeIds.length) {
      return {
        changed: false,
        requiresFullSync: false
      }
    }

    const nextCellSize = this.getCellSize()
    if (nextCellSize !== this.cellSize) {
      return {
        changed: false,
        requiresFullSync: true
      }
    }

    let changed = false
    let requiresFullSync = false

    nodeIds.forEach((nodeId) => {
      const entry = getEntryById(nodeId)
      const current = this.byId.get(nodeId)

      if (!entry) {
        if (!current) return
        this.removeFromBuckets(nodeId, current.cellKeys)
        this.byId.delete(nodeId)
        this.orderDirty = true
        changed = true
        const index = this.orderedIds.indexOf(nodeId)
        if (index >= 0) {
          this.orderedIds = [
            ...this.orderedIds.slice(0, index),
            ...this.orderedIds.slice(index + 1)
          ]
        }
        return
      }

      if (!current) {
        const signature = toRectSignature(entry.aabb)
        const candidate = this.toCandidate(nodeId, entry.aabb)
        const cellKeys = toCellKeys(candidate.rect, this.cellSize)
        this.addToBuckets(nodeId, cellKeys)
        this.byId.set(nodeId, {
          signature,
          candidate,
          cellKeys
        })
        this.orderDirty = true
        changed = true
        return
      }

      const signature = toRectSignature(entry.aabb)
      if (current.signature === signature) {
        return
      }

      const candidate = this.toCandidate(nodeId, entry.aabb)
      const cellKeys = toCellKeys(candidate.rect, this.cellSize)
      this.removeFromBuckets(nodeId, current.cellKeys)
      this.addToBuckets(nodeId, cellKeys)
      this.byId.set(nodeId, {
        signature,
        candidate,
        cellKeys
      })
      this.orderDirty = true
      changed = true
    })

    return {
      changed,
      requiresFullSync
    }
  }

  syncOrder = (orderedNodeIds: NodeId[]): boolean => {
    if (isSameIdOrder(this.orderedIds, orderedNodeIds)) {
      return false
    }
    this.orderedIds = orderedNodeIds
    this.orderDirty = true
    return true
  }

  getAll = (): SnapCandidate[] => {
    if (!this.orderDirty) return this.orderedCandidates
    this.orderedCandidates = this.orderedIds
      .map((id) => this.byId.get(id)?.candidate)
      .filter((candidate): candidate is SnapCandidate => Boolean(candidate))
    this.orderDirty = false
    return this.orderedCandidates
  }

  queryInRect = (rect: Rect): SnapCandidate[] => {
    const { minX, maxX, minY, maxY } = getCellRange(rect, this.cellSize)
    const ids = new Set<NodeId>()
    for (let cx = minX; cx <= maxX; cx += 1) {
      for (let cy = minY; cy <= maxY; cy += 1) {
        const bucket = this.buckets.get(keyForCell(cx, cy))
        if (!bucket) continue
        bucket.forEach((id) => ids.add(id))
      }
    }

    return Array.from(ids)
      .map((id) => this.byId.get(id)?.candidate)
      .filter((candidate): candidate is SnapCandidate => Boolean(candidate))
  }
}

export type QueryIndexes = {
  syncFull: (nodes: Node[]) => void
  syncDirty: (
    nodeIds: NodeId[],
    getNodeById: (nodeId: NodeId) => Node | undefined
  ) => boolean
  syncOrder: (orderedNodeIds: NodeId[]) => void
  watchNodeChanges: (listener: (nodeIds: NodeId[]) => void) => () => void
  getNodeRects: () => CanvasNodeRect[]
  getNodeRectById: (nodeId: NodeId) => CanvasNodeRect | undefined
  getSnapCandidates: () => SnapCandidate[]
  getSnapCandidatesInRect: (rect: Rect) => SnapCandidate[]
  getMetrics: () => QueryDebugSnapshot
  resetMetrics: (target?: keyof QueryDebugSnapshot) => void
}

type CreateQueryIndexesOptions = {
  config: InstanceConfig
}

export const createQueryIndexes = ({
  config
}: CreateQueryIndexesOptions): QueryIndexes => {
  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(config.node.snapGridCellSize, config.node.groupPadding * 6)
  )
  const nodeChangeListeners = new Set<(nodeIds: NodeId[]) => void>()
  let canvasMetrics = createMetrics()
  let snapMetrics = createMetrics()

  const emitNodeChanges = (changedNodeIds: Set<NodeId>) => {
    if (!changedNodeIds.size || !nodeChangeListeners.size) return
    const nodeIds = Array.from(changedNodeIds)
    nodeChangeListeners.forEach((listener) => {
      listener(nodeIds)
    })
  }

  const syncFull: QueryIndexes['syncFull'] = (nodes) => {
    const canvasStartedAt = now()
    const nodeRectUpdate = nodeRectIndex.updateFull(nodes)
    const canvasChanged = nodeRectUpdate.changed
    const canvasElapsed = now() - canvasStartedAt
    if (canvasChanged) {
      markRebuild(canvasMetrics, canvasElapsed)
    }

    const snapStartedAt = now()
    const snapChanged = snapIndex.update(nodeRectIndex.getAll())
    const snapElapsed = now() - snapStartedAt
    if (snapChanged) {
      markRebuild(snapMetrics, snapElapsed)
    }

    emitNodeChanges(nodeRectUpdate.changedNodeIds)
  }

  const syncDirty: QueryIndexes['syncDirty'] = (nodeIds, getNodeById) => {
    if (!nodeIds.length) return true

    const canvasStartedAt = now()
    const nodeRectUpdate = nodeRectIndex.updateDirty(nodeIds, getNodeById)
    if (nodeRectUpdate.requiresFullSync) {
      return false
    }
    if (nodeRectUpdate.changed) {
      markRebuild(canvasMetrics, now() - canvasStartedAt)
    }

    const snapStartedAt = now()
    const snapUpdate = snapIndex.updateDirty(
      nodeIds,
      nodeRectIndex.getById
    )
    if (snapUpdate.requiresFullSync) {
      return false
    }
    if (snapUpdate.changed) {
      markRebuild(snapMetrics, now() - snapStartedAt)
    }

    emitNodeChanges(nodeRectUpdate.changedNodeIds)
    return true
  }

  const syncOrder: QueryIndexes['syncOrder'] = (orderedNodeIds) => {
    const canvasStartedAt = now()
    const canvasChanged = nodeRectIndex.syncOrder(orderedNodeIds)
    if (canvasChanged) {
      markRebuild(canvasMetrics, now() - canvasStartedAt)
    }

    const snapStartedAt = now()
    const snapChanged = snapIndex.syncOrder(orderedNodeIds)
    if (snapChanged) {
      markRebuild(snapMetrics, now() - snapStartedAt)
    }
  }

  return {
    syncFull,
    syncDirty,
    syncOrder,
    watchNodeChanges: (listener) => {
      nodeChangeListeners.add(listener)
      return () => {
        nodeChangeListeners.delete(listener)
      }
    },
    getNodeRects: () => {
      markReadHit(canvasMetrics)
      return nodeRectIndex.getAll()
    },
    getNodeRectById: (nodeId) => {
      markReadHit(canvasMetrics)
      return nodeRectIndex.getById(nodeId)
    },
    getSnapCandidates: () => {
      markReadHit(snapMetrics)
      return snapIndex.getAll()
    },
    getSnapCandidatesInRect: (rect) => {
      markReadHit(snapMetrics)
      return snapIndex.queryInRect(rect)
    },
    getMetrics: () => ({
      canvas: { ...canvasMetrics },
      snap: { ...snapMetrics }
    }),
    resetMetrics: (target) => {
      if (target === 'canvas') {
        canvasMetrics = createMetrics()
        return
      }
      if (target === 'snap') {
        snapMetrics = createMetrics()
        return
      }
      canvasMetrics = createMetrics()
      snapMetrics = createMetrics()
    }
  }
}
