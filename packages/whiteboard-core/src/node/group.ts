import type { Node, NodeId, Point, Rect, Size } from '../types'
import { enlargeBox } from '../utils/group'
import { getNodeAABB } from '../geometry'

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
