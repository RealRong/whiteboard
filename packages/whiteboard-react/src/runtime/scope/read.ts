import type {
  EdgeEntry,
  EngineRead
} from '@whiteboard/engine'
import type {
  Edge,
  EdgeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'

export type WhiteboardScopeRead = {
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
  read: EngineRead,
  value: EdgeId | Pick<Edge, 'source' | 'target'>
): Pick<Edge, 'source' | 'target'> | undefined => {
  if (typeof value === 'string') {
    const entry: Readonly<EdgeEntry> | undefined = read.edge.get(value)
    return entry?.edge
  }
  return value
}

export const createScopeRead = ({
  read,
  activeContainerId
}: {
  read: EngineRead
  activeContainerId: () => NodeId | undefined
}): WhiteboardScopeRead => {
  const readActiveId = (): NodeId | undefined => {
    const activeId = activeContainerId()
    if (!activeId) return undefined
    return read.index.node.byId(activeId)?.node ? activeId : undefined
  }

  const readNodeIds = (): readonly NodeId[] => {
    const activeId = readActiveId()
    return activeId
      ? read.index.tree.ids(activeId)
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
        ? read.index.node.byId(activeId)?.rect
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
