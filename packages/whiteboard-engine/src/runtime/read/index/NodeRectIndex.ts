import type { Node, NodeId } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '@engine-types/instance/read'
import type { InstanceConfig } from '@engine-types/instance/config'
import { toNodeStateSignature } from '@whiteboard/core/cache'
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

export class NodeRectIndex {
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
