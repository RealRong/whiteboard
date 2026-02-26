import type {
  ProjectionCommit,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  NodeViewItem,
} from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core/types'
import { hasImpactTag } from '../../../runtime/mutation/Impact'
import { toLayerOrderedCanvasNodes } from '../query'
import { isSameIdOrder } from '../../../runtime/view/shared'
import { NodeProjectionCache } from './NodeProjectionCache'

type NodeViewItemEntry = NodeViewItem

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
}

export type NodeRegistry = {
  applyCommit: (commit: ProjectionCommit) => boolean
  getNodeItemsMap: () => ReadonlyMap<NodeId, NodeViewItemEntry>
  getNodeIds: () => NodeId[]
}

export const createNodeRegistry = ({
  query,
  readProjection
}: Options): NodeRegistry => {
  const cache = new NodeProjectionCache(query)
  let nodeIds: NodeId[] = []

  const syncNodeOrder = () => {
    const nextNodeIds = toLayerOrderedCanvasNodes(readProjection().nodes.canvas).map(
      (node) => node.id
    )
    if (isSameIdOrder(nodeIds, nextNodeIds)) return false
    nodeIds = nextNodeIds
    return true
  }

  const syncFull = () => {
    const snapshot = readProjection()
    let changed = syncNodeOrder()
    const changedNodeIds = new Set<NodeId>(nodeIds)
    for (const nodeId of cache.getNodeIds()) {
      changedNodeIds.add(nodeId)
    }
    if (!changedNodeIds.size) return changed
    changed = cache.syncByIds(
      changedNodeIds,
      snapshot.indexes.canvasNodeById
    ) || changed
    return changed
  }

  const applyCommit: NodeRegistry['applyCommit'] = (commit) => {
    const impact = commit.impact
    const fullSync = commit.kind === 'replace' || hasImpactTag(impact, 'full')
    if (fullSync) {
      return syncFull()
    }

    const dirtyNodeIds = impact.dirtyNodeIds
    const orderChanged = hasImpactTag(impact, 'order')
    const nodesChanged = hasImpactTag(impact, 'nodes')
    const hasDirtyNodeIds = Boolean(dirtyNodeIds?.length)

    if (!orderChanged && !nodesChanged && !hasDirtyNodeIds) {
      return false
    }

    let changed = false
    const snapshot = readProjection()
    if (dirtyNodeIds?.length) {
      changed = cache.syncByIds(
        dirtyNodeIds,
        snapshot.indexes.canvasNodeById
      ) || changed
    }

    if (orderChanged) {
      changed = syncNodeOrder() || changed
    }

    if (nodesChanged && !hasDirtyNodeIds) {
      changed = syncFull() || changed
    }
    return changed
  }

  return {
    applyCommit,
    getNodeItemsMap: () => cache.getNodeItemsMap(),
    getNodeIds: () => nodeIds
  }
}
