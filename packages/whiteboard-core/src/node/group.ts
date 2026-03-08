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
import { enlargeBox } from '../utils/group'
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

export const getGroupChildrenMap = (nodes: readonly Node[]) => {
  const map = new Map<NodeId, Node[]>()
  nodes.forEach((node) => {
    if (!node.parentId) return
    const list = map.get(node.parentId) ?? []
    list.push(node)
    map.set(node.parentId, list)
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

export const getCollapsedGroupIds = (nodes: readonly Node[]) => {
  const set = new Set<NodeId>()
  nodes.forEach((node) => {
    if (node.type !== 'group') return
    const collapsed =
      node.data && typeof node.data.collapsed === 'boolean'
        ? node.data.collapsed
        : false
    if (collapsed) {
      set.add(node.id)
    }
  })
  return set
}

export const isHiddenByCollapsedGroup = (
  node: Node,
  nodeMap: ReadonlyMap<NodeId, Node>,
  collapsedGroupIds: ReadonlySet<NodeId>
) => {
  let parentId = node.parentId
  while (parentId) {
    if (collapsedGroupIds.has(parentId)) return true
    const parent = nodeMap.get(parentId)
    parentId = parent?.parentId
  }
  return false
}

export const expandGroupRect = (
  groupRect: Rect,
  contentRect: Rect,
  padding: number
): Rect => {
  const padded = enlargeBox(contentRect, padding)
  const left = Math.min(groupRect.x, padded.x)
  const top = Math.min(groupRect.y, padded.y)
  const right = Math.max(groupRect.x + groupRect.width, padded.x + padded.width)
  const bottom = Math.max(groupRect.y + groupRect.height, padded.y + padded.height)
  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  }
}

export const rectEquals = (a: Rect, b: Rect, epsilon: number) => (
  Math.abs(a.x - b.x) <= epsilon &&
  Math.abs(a.y - b.y) <= epsilon &&
  Math.abs(a.width - b.width) <= epsilon &&
  Math.abs(a.height - b.height) <= epsilon
)

const createChildIdsByParentId = (nodes: readonly Node[]) => {
  const childIdsByParentId = new Map<NodeId, NodeId[]>()
  nodes.forEach((node) => {
    if (!node.parentId) return
    const childIds = childIdsByParentId.get(node.parentId)
    if (childIds) {
      childIds.push(node.id)
      return
    }
    childIdsByParentId.set(node.parentId, [node.id])
  })
  return childIdsByParentId
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
    const parentId = node?.parentId
    const parent = parentId ? nodeById[parentId] : undefined
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
  groupPadding,
  rectEpsilon
}: {
  group: Node
  children: readonly Node[]
  nodeSize: Size
  groupPadding: number
  rectEpsilon: number
}): GroupBoundsOperation | null => {
  if (!children.length) return null

  const contentRect = getNodesBoundingRect(children, nodeSize)
  if (!contentRect) return null

  const groupRect = getNodeAABB(group, nodeSize)
  const nextRect = expandGroupRect(groupRect, contentRect, groupPadding)
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
  groupPadding,
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

  const childIdsByParentId = createChildIdsByParentId(orderedNodes)
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

    const childIds = childIdsByParentId.get(groupId) ?? EMPTY_NODE_IDS
    if (!childIds.length) return

    const children = childIds
      .map((childId) => workingNodes[childId])
      .filter((node): node is Node => Boolean(node))

    const operation = createGroupBoundsOperation({
      group,
      children,
      nodeSize,
      groupPadding,
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

export const findSmallestGroupAtPoint = (
  nodes: Node[],
  fallbackSize: Size,
  point: Point,
  excludeId?: NodeId
) => {
  let best: { node: Node; area: number } | undefined
  nodes.forEach((node) => {
    if (node.type !== 'group') return
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
