import type {
  EdgeEntry,
  EngineRead
} from '@whiteboard/engine'
import { getContainerDescendants } from '@whiteboard/core/node'
import type {
  Edge,
  EdgeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { Node } from '@whiteboard/core/types'

export type WhiteboardContainerRead = {
  activeId: () => NodeId | undefined
  activeRect: () => Rect | undefined
  nodeIds: () => readonly NodeId[]
  filterNodeIds: (nodeIds: readonly NodeId[]) => readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}

type ScopeSnapshot = {
  activeId?: NodeId
  active?: NonNullable<ReturnType<EngineRead['index']['node']['byId']>>
  ids: readonly NodeId[]
  nodes: readonly Node[]
  nodeIds: readonly NodeId[]
  nodeSet?: ReadonlySet<NodeId>
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODES: readonly Node[] = []

const isSameNodeRefs = (
  left: readonly Node[],
  right: readonly Node[]
) => (
  left.length === right.length
  && left.every((node, index) => node === right[index])
)

const toNodeSet = (
  nodes: readonly Node[],
  containerId?: NodeId
): ReadonlySet<NodeId> | undefined => {
  if (!containerId) return undefined
  return new Set(
    getContainerDescendants(nodes, containerId).map((node) => node.id)
  )
}

const hasNode = (
  nodeId: NodeId,
  nodeSet?: ReadonlySet<NodeId>
) => !nodeSet || nodeSet.has(nodeId)

const filterNodeIds = (
  nodeIds: readonly NodeId[],
  nodeSet?: ReadonlySet<NodeId>
) => (
  nodeSet
    ? nodeIds.filter((nodeId) => nodeSet.has(nodeId))
    : nodeIds
)

const hasEdge = (
  edge: Pick<Edge, 'source' | 'target'>,
  nodeSet?: ReadonlySet<NodeId>
) => (
  !nodeSet
  || (
    nodeSet.has(edge.source.nodeId)
    && nodeSet.has(edge.target.nodeId)
  )
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

export const createContainerRead = ({
  read,
  activeContainerId
}: {
  read: EngineRead
  activeContainerId: () => NodeId | undefined
}): WhiteboardContainerRead => {
  let cache: ScopeSnapshot = {
    activeId: undefined,
    active: undefined,
    ids: EMPTY_NODE_IDS,
    nodes: EMPTY_NODES,
    nodeIds: EMPTY_NODE_IDS,
    nodeSet: undefined
  }

  const readScope = (): ScopeSnapshot => {
    const activeId = activeContainerId()
    const ids = read.node.ids()
    const nodes = ids
      .map((nodeId) => read.node.get(nodeId)?.node)
      .filter((node): node is Node => Boolean(node))
    const active = activeId
      ? read.index.node.byId(activeId)
      : undefined

    if (
      cache.activeId === activeId
      && cache.active === active
      && cache.ids === ids
      && isSameNodeRefs(cache.nodes, nodes)
    ) {
      return cache
    }

    if (!activeId || !active) {
      cache = {
        activeId: undefined,
        active: undefined,
        ids,
        nodes,
        nodeIds: EMPTY_NODE_IDS,
        nodeSet: undefined
      }
      return cache
    }

    const nodeSet = toNodeSet(nodes, activeId)
    cache = {
      activeId,
      active,
      ids,
      nodes,
      nodeIds: nodeSet
        ? ids.filter((nodeId) => nodeSet.has(nodeId))
        : EMPTY_NODE_IDS,
      nodeSet
    }
    return cache
  }

  return {
    activeId: () => readScope().activeId,
    activeRect: () => readScope().active?.rect,
    nodeIds: () => readScope().nodeIds,
    filterNodeIds: (nodeIds) => filterNodeIds(nodeIds, readScope().nodeSet),
    hasNode: (nodeId) => hasNode(nodeId, readScope().nodeSet),
    hasEdge: (edge) => {
      const resolvedEdge = resolveEdge(read, edge)
      if (!resolvedEdge) return false
      return hasEdge(resolvedEdge, readScope().nodeSet)
    }
  }
}
