import type { ProjectionStore } from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type { State } from '@engine-types/instance/state'
import type {
  NodeTransformHandle,
  NodeViewItem,
  NodesView
} from '@engine-types/instance/view'
import type { NodeId } from '@whiteboard/core/types'
import {
  createNodeRegistry,
  type NodeStateSyncKey
} from './NodeRegistry'

type SyncCanvasNodesOptions = {
  dirtyNodeIds?: NodeId[]
  orderChanged?: boolean
  fullSync?: boolean
}

type Options = {
  state: State
  query: Query
  projection: ProjectionStore
}

type NodeViewRefs = {
  ids: NodeId[]
  itemsById: ReadonlyMap<NodeId, NodeViewItem>
  handlesById: ReadonlyMap<NodeId, readonly NodeTransformHandle[]>
}

export type NodeDomain = {
  syncState: (key: NodeStateSyncKey) => boolean
  syncGraph: (options?: SyncCanvasNodesOptions) => boolean
  getState: () => NodesView
}

export const createNodeDomain = ({
  state,
  query,
  projection
}: Options): NodeDomain => {
  const node = createNodeRegistry({
    state,
    query,
    projection
  })

  const readNodeItems = () =>
    node.getNodeItemsMap() as ReadonlyMap<NodeId, NodeViewItem>

  const readNodeHandles = () =>
    node.getNodeHandlesMap() as ReadonlyMap<NodeId, readonly NodeTransformHandle[]>

  const captureRefs = (): NodeViewRefs => ({
    ids: node.getNodeIds(),
    itemsById: readNodeItems(),
    handlesById: readNodeHandles()
  })

  const hasRefsChanged = (before: NodeViewRefs) =>
    before.ids !== node.getNodeIds() ||
    before.itemsById !== readNodeItems() ||
    before.handlesById !== readNodeHandles()

  const syncState = (key: NodeStateSyncKey) => {
    const before = captureRefs()
    node.syncState(key)
    return hasRefsChanged(before)
  }

  const syncGraph = (options?: SyncCanvasNodesOptions) => {
    const before = captureRefs()
    node.syncCanvasNodes(options)
    return hasRefsChanged(before)
  }

  const getState = (): NodesView => ({
    ids: node.getNodeIds(),
    byId: readNodeItems(),
    handlesById: readNodeHandles()
  })

  return {
    syncState,
    syncGraph,
    getState
  }
}
