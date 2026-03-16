import type { EdgeItem } from '@whiteboard/core/read'
import type {
  Edge,
  EdgeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/core/runtime'

type ContainerEngineRead = {
  edge: {
    item: {
      get: (edgeId: EdgeId) => Readonly<EdgeItem> | undefined
    }
  }
  index: {
    node: {
      get: (nodeId: NodeId) => {
        node?: unknown
        rect: Rect
      } | undefined
    }
    tree: {
      list: (nodeId: NodeId) => readonly NodeId[]
      has: (rootId: NodeId, nodeId: NodeId) => boolean
    }
  }
}

export type WhiteboardContainerRead = {
  activeId: () => NodeId | undefined
  activeRect: () => Rect | undefined
  nodeIds: () => readonly NodeId[]
  filterNodeIds: (nodeIds: readonly NodeId[]) => readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}

const EMPTY_NODE_IDS: readonly NodeId[] = []

const filterNodeIds = (
  nodeIds: readonly NodeId[],
  hasNode: (nodeId: NodeId) => boolean,
  activeId?: NodeId
) => (
  activeId
    ? nodeIds.filter((nodeId) => hasNode(nodeId))
    : nodeIds
)

const hasEdge = (
  edge: Pick<Edge, 'source' | 'target'>,
  hasNode: (nodeId: NodeId) => boolean
) => (
  hasNode(edge.source.nodeId)
  && hasNode(edge.target.nodeId)
)

const resolveEdge = (
  read: ContainerEngineRead,
  value: EdgeId | Pick<Edge, 'source' | 'target'>
): Pick<Edge, 'source' | 'target'> | undefined => {
  if (typeof value === 'string') {
    const entry: Readonly<EdgeItem> | undefined = read.edge.item.get(value)
    return entry?.edge
  }
  return value
}

export const createContainerRead = ({
  read,
  activeId
}: {
  read: ContainerEngineRead
  activeId: ReadStore<NodeId | undefined>
}): WhiteboardContainerRead => {
  const readActiveId = (): NodeId | undefined => {
    const current = activeId.get()
    if (!current) return undefined
    return read.index.node.get(current)?.node ? current : undefined
  }

  const readNodeIds = (): readonly NodeId[] => {
    const activeId = readActiveId()
    return activeId
      ? read.index.tree.list(activeId)
      : EMPTY_NODE_IDS
  }

  const readHasNode = (nodeId: NodeId): boolean => {
    const activeId = readActiveId()
    return activeId
      ? read.index.tree.has(activeId, nodeId)
      : true
  }

  return {
    activeId: readActiveId,
    activeRect: () => {
      const activeId = readActiveId()
      return activeId
        ? read.index.node.get(activeId)?.rect
        : undefined
    },
    nodeIds: readNodeIds,
    filterNodeIds: (nodeIds) => filterNodeIds(nodeIds, readHasNode, readActiveId()),
    hasNode: readHasNode,
    hasEdge: (edge) => {
      const resolvedEdge = resolveEdge(read, edge)
      if (!resolvedEdge) return false
      return hasEdge(resolvedEdge, readHasNode)
    }
  }
}
