import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import { getNodeIdsInRect as getNodeIdsInRectRaw } from '@whiteboard/core/node'
import type { CanvasNodeRect } from '@engine-types/instance'
import type { InstanceConfig } from '@engine-types/instance'
import type { ReadModel } from '@engine-types/read'
import { isSameRefOrder } from '@whiteboard/core/utils'
import { NodeGeometryCache } from '../../geometry/nodeGeometry'

type Rebuild = 'none' | 'dirty' | 'full'

export class NodeRectIndex {
  private geometry: NodeGeometryCache
  private orderedIds: NodeId[] = []
  private orderedIdSet = new Set<NodeId>()
  private orderedEntries: CanvasNodeRect[] = []
  private orderDirty = true

  constructor(config: InstanceConfig) {
    this.geometry = new NodeGeometryCache(config.nodeSize)
  }

  applyChange = (
    rebuild: Rebuild,
    nodeIds: readonly NodeId[],
    model: ReadModel
  ): boolean => {
    switch (rebuild) {
      case 'none':
        return false
      case 'full':
        return this.syncFull(model.nodes.canvas)
      case 'dirty':
        return this.syncByNodeIds(
          nodeIds,
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

  all = (): CanvasNodeRect[] => {
    if (!this.orderDirty) return this.orderedEntries
    this.orderedEntries = this.orderedIds
      .map((id) => this.geometry.get(id))
      .filter((entry): entry is CanvasNodeRect => Boolean(entry))
    this.orderDirty = false
    return this.orderedEntries
  }

  nodeIdsInRect = (rect: Rect): NodeId[] =>
    getNodeIdsInRectRaw(rect, this.all())

  byId = (nodeId: NodeId): CanvasNodeRect | undefined =>
    this.geometry.get(nodeId)
}
