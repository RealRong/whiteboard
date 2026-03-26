import type {
  Document,
  Node,
  NodeId,
  Operation,
  Point,
  Rect,
  Size
} from '../types'
import { listNodes } from '../types'
import { getNodeAABB } from '../geometry'

type OwnedNode = Pick<Node, 'id' | 'type' | 'children'>

export type NormalizeGroupBoundsOptions = {
  document: Pick<Document, 'nodes'>
  nodeSize: Size
  groupPadding: number
  rectEpsilon: number
}

type GroupBoundsOperation = {
  type: 'node.update'
  id: NodeId
  patch: {
    position: Point
    size: Size
  }
}

const EMPTY_NODE_IDS: readonly NodeId[] = []

const readChildren = (
  node: Pick<Node, 'children'> | undefined
): readonly NodeId[] => node?.children ?? EMPTY_NODE_IDS

const toNodeById = <TNode extends Pick<Node, 'id'>>(
  nodes: readonly TNode[]
): ReadonlyMap<NodeId, TNode> =>
  new Map(nodes.map((node) => [node.id, node]))

export const isContainerNode = (
  node: Pick<Node, 'type'>
) => node.type === 'frame'

export const isOwnerNode = (
  node: Pick<Node, 'type'>
) => node.type === 'group' || isContainerNode(node)

export const getNodesBoundingRect = (
  nodes: readonly Node[],
  fallbackSize: Size
): Rect | undefined => {
  if (!nodes.length) return undefined

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  nodes.forEach((node) => {
    const rect = getNodeAABB(node, fallbackSize)
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  })

  if (
    !Number.isFinite(minX)
    || !Number.isFinite(minY)
    || !Number.isFinite(maxX)
    || !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

export const getNodeOwnerMap = (
  nodes: readonly Pick<Node, 'id' | 'children'>[]
): ReadonlyMap<NodeId, NodeId> => {
  const ownerByChildId = new Map<NodeId, NodeId>()

  nodes.forEach((node) => {
    readChildren(node).forEach((childId) => {
      ownerByChildId.set(childId, node.id)
    })
  })

  return ownerByChildId
}

const getDirectChildren = <TNode extends Pick<Node, 'id' | 'children'>>(
  nodesById: ReadonlyMap<NodeId, TNode>,
  ownerId: NodeId
): TNode[] => {
  const owner = nodesById.get(ownerId)
  if (!owner) {
    return []
  }

  return readChildren(owner)
    .map((childId) => nodesById.get(childId))
    .filter((child): child is TNode => Boolean(child))
}

const getNodeDescendants = <TNode extends Pick<Node, 'id' | 'children'>>(
  nodes: readonly TNode[],
  ownerId: NodeId
): TNode[] => {
  const nodesById = toNodeById(nodes)
  const result: TNode[] = []
  const visited = new Set<NodeId>()
  const stack = [...getDirectChildren(nodesById, ownerId)].reverse()

  while (stack.length > 0) {
    const node = stack.pop()
    if (!node || visited.has(node.id)) {
      continue
    }

    visited.add(node.id)
    result.push(node)

    const children = getDirectChildren(nodesById, node.id)
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push(children[index]!)
    }
  }

  return result
}

export const getContainerChildrenMap = (nodes: readonly Node[]) => {
  const nodesById = toNodeById(nodes)
  const map = new Map<NodeId, Node[]>()

  nodes.forEach((node) => {
    if (!isContainerNode(node)) {
      return
    }

    const children = getDirectChildren(nodesById, node.id)
    if (children.length > 0) {
      map.set(node.id, children)
    }
  })

  return map
}

export const getContainerDescendants = (
  nodes: readonly Node[],
  containerId: NodeId
): Node[] => getNodeDescendants(nodes, containerId)

export const getGroupChildrenMap = <TNode extends OwnedNode>(
  nodes: readonly TNode[]
) => {
  const nodesById = toNodeById(nodes)
  const map = new Map<NodeId, TNode[]>()

  nodes.forEach((node) => {
    if (node.type !== 'group') {
      return
    }

    const children = getDirectChildren(nodesById, node.id)
    if (children.length > 0) {
      map.set(node.id, children)
    }
  })

  return map
}

export const getGroupDescendants = <TNode extends OwnedNode>(
  nodes: readonly TNode[],
  groupId: NodeId
): TNode[] => getNodeDescendants(nodes, groupId)

const hasSelectedAncestor = (
  nodeId: NodeId,
  selectedIds: ReadonlySet<NodeId>,
  ownerByChildId: ReadonlyMap<NodeId, NodeId>
) => {
  let current = ownerByChildId.get(nodeId)

  while (current) {
    if (selectedIds.has(current)) {
      return true
    }
    current = ownerByChildId.get(current)
  }

  return false
}

export const findGroupAncestor = <
  TNode extends Pick<Node, 'id' | 'type'>
>(
  nodeId: NodeId,
  readNode: (nodeId: NodeId) => TNode | undefined,
  readOwnerId: (nodeId: NodeId) => NodeId | undefined,
  match?: (groupId: NodeId, group: TNode) => boolean
) => {
  let currentId: NodeId | undefined = nodeId

  while (currentId) {
    const ownerId = readOwnerId(currentId)
    if (!ownerId) {
      return undefined
    }

    const owner = readNode(ownerId)
    if (!owner) {
      return undefined
    }

    if (
      owner.type === 'group'
      && (!match || match(owner.id, owner))
    ) {
      return owner.id
    }

    currentId = owner.id
  }

  return undefined
}

export const filterRootIds = <TNode extends OwnedNode>(
  nodes: readonly TNode[],
  ids: readonly NodeId[]
): NodeId[] => {
  if (!ids.length) {
    return []
  }

  const nodesById = toNodeById(nodes)
  const ownerByChildId = getNodeOwnerMap(nodes)
  const uniqueIds = Array.from(new Set(ids)).filter((id) => nodesById.has(id))
  if (!uniqueIds.length) {
    return []
  }

  const selectedIds = new Set(uniqueIds)
  return uniqueIds.filter((id) => !hasSelectedAncestor(id, selectedIds, ownerByChildId))
}

export const expandGroupMembers = <TNode extends OwnedNode>(
  nodes: readonly TNode[],
  rootIds: readonly NodeId[]
): TNode[] => {
  if (!rootIds.length) {
    return []
  }

  const nodesById = toNodeById(nodes)
  const memberIds = new Set<NodeId>()

  rootIds.forEach((rootId) => {
    const root = nodesById.get(rootId)
    if (!root) {
      return
    }

    memberIds.add(root.id)
    if (root.type !== 'group') {
      return
    }

    getGroupDescendants(nodes, root.id).forEach((child) => {
      memberIds.add(child.id)
    })
  })

  return nodes.filter((node) => memberIds.has(node.id))
}

export const rectEquals = (a: Rect, b: Rect, epsilon: number) => (
  Math.abs(a.x - b.x) <= epsilon &&
  Math.abs(a.y - b.y) <= epsilon &&
  Math.abs(a.width - b.width) <= epsilon &&
  Math.abs(a.height - b.height) <= epsilon
)

const sortGroupIdsBottomUp = ({
  groupIds,
  ownerByChildId,
  nodeById,
  orderIndexById
}: {
  groupIds: readonly NodeId[]
  ownerByChildId: ReadonlyMap<NodeId, NodeId>
  nodeById: Readonly<Record<NodeId, Node>>
  orderIndexById: ReadonlyMap<NodeId, number>
}) => {
  const depthById = new Map<NodeId, number>()

  const resolveDepth = (nodeId: NodeId): number => {
    const cached = depthById.get(nodeId)
    if (cached !== undefined) return cached

    const ownerId = ownerByChildId.get(nodeId)
    const owner = ownerId ? nodeById[ownerId] : undefined
    const depth = owner?.type === 'group'
      ? resolveDepth(owner.id) + 1
      : 0
    depthById.set(nodeId, depth)
    return depth
  }

  return [...groupIds].sort((left, right) => {
    const depthDiff = resolveDepth(right) - resolveDepth(left)
    if (depthDiff !== 0) return depthDiff
    return (orderIndexById.get(left) ?? 0) - (orderIndexById.get(right) ?? 0)
  })
}

const createGroupBoundsOperation = ({
  group,
  children,
  nodeSize,
  rectEpsilon
}: {
  group: Node
  children: readonly Node[]
  nodeSize: Size
  rectEpsilon: number
}): GroupBoundsOperation | null => {
  if (!children.length) return null

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return null

  const groupRect = getNodeAABB(group, nodeSize)
  if (rectEquals(contentRect, groupRect, rectEpsilon)) {
    return null
  }

  return {
    type: 'node.update',
    id: group.id,
    patch: {
      position: { x: contentRect.x, y: contentRect.y },
      size: {
        width: contentRect.width,
        height: contentRect.height
      }
    }
  }
}

export const normalizeGroupBounds = ({
  document,
  nodeSize,
  groupPadding: _groupPadding,
  rectEpsilon
}: NormalizeGroupBoundsOptions): Operation[] => {
  const orderedNodes = listNodes(document)
  if (!orderedNodes.length) return []

  const orderIndexById = new Map<NodeId, number>()
  const groupIds: NodeId[] = []

  orderedNodes.forEach((node, index) => {
    orderIndexById.set(node.id, index)
    if (node.type === 'group') {
      groupIds.push(node.id)
    }
  })

  if (!groupIds.length) {
    return []
  }

  const ownerByChildId = getNodeOwnerMap(orderedNodes)
  const workingNodes: Record<NodeId, Node> = {
    ...document.nodes.entities
  }
  const operations: Operation[] = []
  const sortedGroupIds = sortGroupIdsBottomUp({
    groupIds,
    ownerByChildId,
    nodeById: workingNodes,
    orderIndexById
  })

  sortedGroupIds.forEach((groupId) => {
    const group = workingNodes[groupId]
    if (!group || group.type !== 'group') {
      return
    }

    const childIds = readChildren(group)
    if (!childIds.length) {
      return
    }

    const children = childIds
      .map((childId) => workingNodes[childId])
      .filter((node): node is Node => Boolean(node))

    const operation = createGroupBoundsOperation({
      group,
      children,
      nodeSize,
      rectEpsilon
    })
    if (!operation) {
      return
    }

    operations.push(operation)
    workingNodes[group.id] = {
      ...group,
      position: operation.patch.position,
      size: operation.patch.size
    }
  })

  return operations
}

const pointInRect = (point: Point, rect: Rect) => (
  point.x >= rect.x &&
  point.y >= rect.y &&
  point.x <= rect.x + rect.width &&
  point.y <= rect.y + rect.height
)

export const findSmallestContainerAtPoint = (
  nodes: readonly Node[],
  fallbackSize: Size,
  point: Point,
  excludeId?: NodeId
) => {
  let best: { node: Node; area: number } | undefined

  nodes.forEach((node) => {
    if (!isContainerNode(node)) return
    if (excludeId && node.id === excludeId) return

    const rect = getNodeAABB(node, fallbackSize)
    if (!pointInRect(point, rect)) return

    const area = rect.width * rect.height
    if (!best || area < best.area) {
      best = { node, area }
    }
  })

  return best?.node
}
