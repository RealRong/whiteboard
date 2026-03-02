import type { Node, NodeId } from '@whiteboard/core/types'
import type { CanvasNodeRect } from '@engine-types/instance/read'
import type { InstanceConfig } from '@engine-types/instance/config'
import { getNodeAABB, getNodeRect } from '@whiteboard/core/geometry'
import {
  isSameRectWithRotationTuple,
  isSameRefOrder,
  toFiniteOrUndefined
} from '@whiteboard/core/utils'

type NodeRectStateTuple = {
  x?: number
  y?: number
  width?: number
  height?: number
  rotation?: number
}

type NodeRectCacheEntry = {
  state: NodeRectStateTuple
  entry: CanvasNodeRect
}

export class NodeRectIndex {
  private entriesById = new Map<NodeId, NodeRectCacheEntry>()
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

  private toStateTuple = (node: Node): NodeRectStateTuple => {
    const size = node.size ?? this.config.nodeSize
    return {
      x: toFiniteOrUndefined(node.position.x),
      y: toFiniteOrUndefined(node.position.y),
      width: toFiniteOrUndefined(size.width),
      height: toFiniteOrUndefined(size.height),
      rotation: toFiniteOrUndefined(node.rotation ?? 0)
    }
  }

  syncFull = (nodes: Node[]): boolean => {
    const seen = new Set<NodeId>()
    const nextOrderedIds: NodeId[] = []
    let changed = false

    nodes.forEach((node) => {
      seen.add(node.id)
      nextOrderedIds.push(node.id)

      const state = this.toStateTuple(node)
      const current = this.entriesById.get(node.id)
      if (current && isSameRectWithRotationTuple(current.state, state)) {
        return
      }

      this.entriesById.set(node.id, {
        state,
        entry: this.toEntry(node)
      })
      this.orderDirty = true
      changed = true
    })

    this.entriesById.forEach((_, nodeId) => {
      if (seen.has(nodeId)) return
      this.entriesById.delete(nodeId)
      this.orderDirty = true
      changed = true
    })

    if (!isSameRefOrder(this.orderedIds, nextOrderedIds)) {
      this.orderedIds = nextOrderedIds
      this.orderDirty = true
      changed = true
    }

    return changed
  }

  syncByNodeIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ): boolean => {
    const removed = new Set<NodeId>()
    let changed = false

    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId)
      const current = this.entriesById.get(nodeId)
      if (!node) {
        if (!current) continue
        this.entriesById.delete(nodeId)
        removed.add(nodeId)
        this.orderDirty = true
        changed = true
        continue
      }

      const state = this.toStateTuple(node)
      if (current && isSameRectWithRotationTuple(current.state, state)) continue

      this.entriesById.set(nodeId, {
        state,
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

  all = (): CanvasNodeRect[] => {
    if (!this.orderDirty) return this.orderedEntries
    this.orderedEntries = this.orderedIds
      .map((id) => this.entriesById.get(id)?.entry)
      .filter((entry): entry is CanvasNodeRect => Boolean(entry))
    this.orderDirty = false
    return this.orderedEntries
  }

  byId = (nodeId: NodeId): CanvasNodeRect | undefined =>
    this.entriesById.get(nodeId)?.entry
}
