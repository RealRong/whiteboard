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

export const isContainerNode = (
  node: Pick<Node, 'type'>
) => node.type === 'frame'

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
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
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

export const getContainerChildrenMap = (nodes: readonly Node[]) => {
  const map = new Map<NodeId, Node[]>()
  nodes.forEach((node) => {
    if (!node.containerId) return
    const list = map.get(node.containerId) ?? []
    list.push(node)
    map.set(node.containerId, list)
  })
  return map
}

export const getContainerDescendants = (nodes: readonly Node[], containerId: NodeId): Node[] => {
  const map = getContainerChildrenMap(nodes)
  const result: Node[] = []
  const stack = [...(map.get(containerId) ?? [])]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    result.push(node)
    const children = map.get(node.id)
    if (children) {
      children.forEach((child) => stack.push(child))
    }
  }
  return result
}

export const getGroupChildrenMap = (nodes: readonly Node[]) => {
  const map = new Map<NodeId, Node[]>()
  nodes.forEach((node) => {
    if (!node.groupId) return
    const list = map.get(node.groupId) ?? []
    list.push(node)
    map.set(node.groupId, list)
  })
  return map
}

export const getGroupDescendants = (nodes: readonly Node[], groupId: NodeId): Node[] => {
  const map = getGroupChildrenMap(nodes)
  const result: Node[] = []
  const stack = [...(map.get(groupId) ?? [])]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    result.push(node)
    const children = map.get(node.id)
    if (children) {
      children.forEach((child) => stack.push(child))
    }
  }
  return result
}

export const rectEquals = (a: Rect, b: Rect, epsilon: number) => (
  Math.abs(a.x - b.x) <= epsilon &&
  Math.abs(a.y - b.y) <= epsilon &&
  Math.abs(a.width - b.width) <= epsilon &&
  Math.abs(a.height - b.height) <= epsilon
)

const createChildIdsByGroupId = (nodes: readonly Node[]) => {
  const childIdsByGroupId = new Map<NodeId, NodeId[]>()
  nodes.forEach((node) => {
    if (!node.groupId) return
    const childIds = childIdsByGroupId.get(node.groupId)
    if (childIds) {
      childIds.push(node.id)
      return
    }
    childIdsByGroupId.set(node.groupId, [node.id])
  })
  return childIdsByGroupId
}

const sortGroupIdsBottomUp = ({
  groupIds,
  nodeById,
  orderIndexById
}: {
  groupIds: readonly NodeId[]
  nodeById: Readonly<Record<NodeId, Node>>
  orderIndexById: ReadonlyMap<NodeId, number>
}) => {
  const depthById = new Map<NodeId, number>()

  const resolveDepth = (nodeId: NodeId): number => {
    const cached = depthById.get(nodeId)
    if (cached !== undefined) return cached

    const node = nodeById[nodeId]
    const parentGroupId = node?.groupId
    const parent = parentGroupId ? nodeById[parentGroupId] : undefined
    const depth = parent?.type === 'group' ? resolveDepth(parent.id) + 1 : 0
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
  const nextRect = contentRect
  if (rectEquals(nextRect, groupRect, rectEpsilon)) return null

  return {
    type: 'node.update',
    id: group.id,
    patch: {
      position: { x: nextRect.x, y: nextRect.y },
      size: { width: nextRect.width, height: nextRect.height }
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
  if (!groupIds.length) return []

  const childIdsByGroupId = createChildIdsByGroupId(orderedNodes)
  const workingNodes: Record<NodeId, Node> = {
    ...document.nodes.entities
  }
  const sortedGroupIds = sortGroupIdsBottomUp({
    groupIds,
    nodeById: workingNodes,
    orderIndexById
  })
  const operations: Operation[] = []

  sortedGroupIds.forEach((groupId) => {
    const group = workingNodes[groupId]
    if (!group || group.type !== 'group') return

    const childIds = childIdsByGroupId.get(groupId) ?? EMPTY_NODE_IDS
    if (!childIds.length) return

    const children = childIds
      .map((childId) => workingNodes[childId])
      .filter((node): node is Node => Boolean(node))

    const operation = createGroupBoundsOperation({
      group,
      children,
      nodeSize,
      rectEpsilon
    })
    if (!operation) return

    operations.push(operation)
    workingNodes[groupId] = {
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
  nodes: Node[],
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
