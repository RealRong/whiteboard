import type {
  ProjectionChange,
  ProjectionSnapshot
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  NodeViewItem,
} from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core/types'
import { toLayerOrderedCanvasNodes } from '../actors/node/query'
import { isSameIdOrder } from './shared'
import { NodeProjectionCache } from './NodeProjectionCache'

type NodeViewItemEntry = NodeViewItem

type Options = {
  query: Query
  readProjection: () => ProjectionSnapshot
}

export type NodeRegistry = {
  syncProjection: (change: ProjectionChange) => boolean
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
    changed = cache.syncByIds(changedNodeIds, snapshot.indexes.canvasNodeById) || changed
    return changed
  }

  const syncProjection: NodeRegistry['syncProjection'] = (change) => {
    if (change.kind === 'full') {
      return syncFull()
    }

    if (!change.projection.canvasNodesChanged && !change.dirtyNodeIds?.length) {
      return false
    }

    let changed = false
    const snapshot = readProjection()
    const dirtyNodeIds = change.dirtyNodeIds
    if (dirtyNodeIds?.length) {
      changed = cache.syncByIds(dirtyNodeIds, snapshot.indexes.canvasNodeById) || changed
    }

    if (change.projection.canvasNodesChanged) {
      changed = syncNodeOrder() || changed
    }
    return changed
  }

  return {
    syncProjection,
    getNodeItemsMap: () => cache.getNodeItemsMap(),
    getNodeIds: () => nodeIds
  }
}
