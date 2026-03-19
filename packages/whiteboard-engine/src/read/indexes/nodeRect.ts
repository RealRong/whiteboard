import type { CanvasNode } from '@whiteboard/core/read'
import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import {
  getNodeIdsInRect as getNodeIdsInRectRaw,
  type NodeRectHitOptions
} from '@whiteboard/core/node'
import type { BoardConfig } from '@engine-types/instance'
import type { ReadModel } from '@engine-types/read'
import type { KernelReadImpact } from '@whiteboard/core/kernel'
import { isSameRefOrder } from '@whiteboard/core/utils'
import { NodeGeometryCache } from '../../geometry/nodeGeometry'

type Rebuild = 'none' | 'dirty' | 'full'

const resolveRebuild = (impact: KernelReadImpact): Rebuild => {
  if (impact.reset || impact.node.list) {
    return 'full'
  }
  if (impact.node.geometry) {
    return impact.node.ids.length === 0 ? 'full' : 'dirty'
  }
  return 'none'
}

export class NodeRectIndex {
  private geometry: NodeGeometryCache
  private orderedIds: NodeId[] = []
  private orderedIdSet = new Set<NodeId>()
  private orderedEntries: CanvasNode[] = []
  private orderDirty = true

  constructor(config: BoardConfig) {
    this.geometry = new NodeGeometryCache(config.nodeSize)
  }

  applyChange = (impact: KernelReadImpact, model: ReadModel): boolean => {
    const rebuild = resolveRebuild(impact)
    switch (rebuild) {
      case 'none':
        return false
      case 'full':
        return this.syncFull(model.nodes.canvas)
      case 'dirty':
        return this.syncByNodeIds(
          impact.node.ids,
          model.indexes.canvasNodeById
        )
      default:
        return false
    }
  }

  private syncFull = (nodes: Node[]): boolean => {
    const nextOrderedIds: NodeId[] = []
    let changed = this.geometry.syncFull(nodes)

    nodes.forEach((node) => {
      nextOrderedIds.push(node.id)
    })

    if (!isSameRefOrder(this.orderedIds, nextOrderedIds)) {
      this.orderedIds = nextOrderedIds
      this.orderedIdSet = new Set(nextOrderedIds)
      this.orderDirty = true
      changed = true
    }

    if (changed) {
      this.orderDirty = true
    }

    return changed
  }

  private syncByNodeIds = (
    nodeIds: Iterable<NodeId>,
    nodeById: ReadonlyMap<NodeId, Node>
  ): boolean => {
    const removed = new Set<NodeId>()
    let changed = false

    for (const nodeId of nodeIds) {
      const node = nodeById.get(nodeId)
      if (!node) {
        if (this.geometry.delete(nodeId)) {
          changed = true
        }
        if (this.orderedIdSet.has(nodeId)) {
          removed.add(nodeId)
          this.orderDirty = true
        }
        continue
      }

      if (this.geometry.update(node)) {
        changed = true
      }
      if (!this.orderedIdSet.has(nodeId)) {
        this.orderedIds.push(nodeId)
        this.orderedIdSet.add(nodeId)
        this.orderDirty = true
      }
    }

    if (removed.size) {
      this.orderedIds = this.orderedIds.filter((nodeId) => !removed.has(nodeId))
      removed.forEach((nodeId) => {
        this.orderedIdSet.delete(nodeId)
      })
    }

    if (changed) {
      this.orderDirty = true
    }

    return changed
  }

  all = (): CanvasNode[] => {
    if (!this.orderDirty) return this.orderedEntries
    this.orderedEntries = this.orderedIds
      .map((id) => this.geometry.get(id))
      .filter((entry): entry is CanvasNode => Boolean(entry))
    this.orderDirty = false
    return this.orderedEntries
  }

  nodeIdsInRect = (
    rect: Rect,
    options?: NodeRectHitOptions
  ): NodeId[] => getNodeIdsInRectRaw(rect, this.all(), options)

  byId = (nodeId: NodeId): CanvasNode | undefined =>
    this.geometry.get(nodeId)
}
