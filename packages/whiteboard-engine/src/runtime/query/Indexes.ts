import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '@engine-types/instance/read'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { SnapCandidate } from '@engine-types/node/snap'
import { DEFAULT_TUNING } from '../../config'
import { toNodeStateSignature, toRectSignature } from '@whiteboard/core/cache'
import { getNodeAABB, getNodeRect } from '@whiteboard/core/geometry'

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

  updateByIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ): boolean => {
    const removed = new Set<NodeId>()
    let changed = false

    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId)
      const current = this.byId.get(nodeId)
      if (!node) {
        if (!current) continue
        this.byId.delete(nodeId)
        removed.add(nodeId)
        this.orderDirty = true
        changed = true
        continue
      }

      const signature = toNodeStateSignature(node, this.config.nodeSize)
      if (current && current.signature === signature) continue

      this.byId.set(nodeId, {
        signature,
        entry: this.toEntry(node)
      })
      if (!current && !this.orderedIds.includes(nodeId)) {
        this.orderedIds.push(nodeId)
      }
      this.orderDirty = true
      changed = true
    }

    if (removed.size) {
      this.orderedIds = this.orderedIds.filter((nodeId) => !removed.has(nodeId))
    }

    return changed
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

  updateByNodeIds = (
    nodeIds: Iterable<NodeId>,
    getEntry: (nodeId: NodeId) => CanvasNodeRect | undefined
  ): boolean => {
    const removed = new Set<NodeId>()
    let changed = false

    for (const nodeId of nodeIds) {
      const entry = getEntry(nodeId)
      const current = this.byId.get(nodeId)

      if (!entry) {
        if (!current) continue
        this.removeFromBuckets(nodeId, current.cellKeys)
        this.byId.delete(nodeId)
        removed.add(nodeId)
        changed = true
        continue
      }

      const signature = toRectSignature(entry.aabb)
      if (current && current.signature === signature) continue

      const candidate = this.toCandidate(nodeId, entry.aabb)
      const cellKeys = toCellKeys(candidate.rect, this.cellSize)
      if (current) {
        this.removeFromBuckets(nodeId, current.cellKeys)
      } else if (!this.orderedIds.includes(nodeId)) {
        this.orderedIds.push(nodeId)
      }
      this.addToBuckets(nodeId, cellKeys)
      this.byId.set(nodeId, {
        signature,
        candidate,
        cellKeys
      })
      changed = true
    }

    if (!changed) return false

    if (removed.size) {
      this.orderedIds = this.orderedIds.filter((nodeId) => !removed.has(nodeId))
    }
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
  sync: (nodes: Node[]) => void
  syncByNodeIds: (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ) => void
  getNodeRects: () => CanvasNodeRect[]
  getNodeRectById: (nodeId: NodeId) => CanvasNodeRect | undefined
  getSnapCandidates: () => SnapCandidate[]
  getSnapCandidatesInRect: (rect: Rect) => SnapCandidate[]
}

type CreateQueryIndexesOptions = {
  config: InstanceConfig
}

export const createQueryIndexes = ({
  config
}: CreateQueryIndexesOptions): QueryIndexes => {
  const nodeRectIndex = new NodeRectIndex(config)
  const snapIndex = new SnapIndex(() =>
    Math.max(
      config.node.snapGridCellSize,
      config.node.groupPadding * DEFAULT_TUNING.query.snapGridPaddingFactor
    )
  )

  const sync: QueryIndexes['sync'] = (nodes) => {
    nodeRectIndex.updateFull(nodes)
    snapIndex.update(nodeRectIndex.getAll())
  }

  const syncByNodeIds: QueryIndexes['syncByNodeIds'] = (nodeIds, nodeById) => {
    const changed = nodeRectIndex.updateByIds(nodeIds, nodeById)
    if (!changed) return
    snapIndex.updateByNodeIds(nodeIds, nodeRectIndex.getById)
  }

  return {
    sync,
    syncByNodeIds,
    getNodeRects: () => nodeRectIndex.getAll(),
    getNodeRectById: (nodeId) => nodeRectIndex.getById(nodeId),
    getSnapCandidates: () => snapIndex.getAll(),
    getSnapCandidatesInRect: (rect) => snapIndex.queryInRect(rect)
  }
}
