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

  updateFull = (nodes: Node[]): { changed: boolean; changedNodeIds: Set<NodeId> } => {
    const seen = new Set<NodeId>()
    const nextOrderedIds: NodeId[] = []
    const changedNodeIds = new Set<NodeId>()
    let changed = false

    nodes.forEach((node) => {
      seen.add(node.id)
      nextOrderedIds.push(node.id)

      const state = this.toStateTuple(node)
      const current = this.byId.get(node.id)
      if (current && isSameRectWithRotationTuple(current.state, state)) {
        return
      }

      this.byId.set(node.id, {
        state,
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

    if (!isSameRefOrder(this.orderedIds, nextOrderedIds)) {
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

      const state = this.toStateTuple(node)
      if (current && isSameRectWithRotationTuple(current.state, state)) continue

      this.byId.set(nodeId, {
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
