import type { Query } from '@engine-types/instance/query'
import type { NodeViewItem } from '@engine-types/instance/view'
import type { Node, NodeId } from '@whiteboard/core/types'
import { projectNodeItem } from './NodeProject'

type Options = {
  query: Query
}

export class NodeProjectionCache {
  private nodeItemsById = new Map<NodeId, NodeViewItem>()

  constructor(private readonly query: Options['query']) {}

  getNodeItemsMap = () => this.nodeItemsById

  getNodeIds = () => this.nodeItemsById.keys()

  syncByIds = (
    targetNodeIds: Iterable<NodeId>,
    canvasNodeById: ReadonlyMap<NodeId, Node>,
    readRotationPreview?: (nodeId: NodeId) => number | undefined
  ) => {
    let nextById = this.nodeItemsById
    let changed = false

    for (const nodeId of targetNodeIds) {
      const node = canvasNodeById.get(nodeId)
      const previous = this.nodeItemsById.get(nodeId)

      if (!node) {
        if (!previous) continue
        nextById = this.ensureMutableMap(this.nodeItemsById, nextById)
        nextById.delete(nodeId)
        changed = true
        continue
      }

      const next = projectNodeItem({
        node,
        query: this.query,
        rotationOverride: readRotationPreview?.(nodeId),
        previous
      })
      if (previous === next) continue

      nextById = this.ensureMutableMap(this.nodeItemsById, nextById)
      nextById.set(nodeId, next)
      changed = true
    }

    if (!changed) return false
    this.nodeItemsById = nextById
    return true
  }

  private ensureMutableMap = <T>(current: Map<NodeId, T>, next: Map<NodeId, T>) =>
    next === current ? new Map(current) : next
}
