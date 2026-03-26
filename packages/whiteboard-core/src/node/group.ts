import type {
  Node,
  NodeId,
  NodePatch,
  Point,
  Rect,
  Size
} from '../types'
import { getNodeAABB } from '../geometry'
import {
  findOwnerAncestor,
  getOwnerChildrenMap,
  getOwnerDescendants
} from './owner'

type OwnedNode = Pick<Node, 'id' | 'type' | 'children'>

export const isContainerNode = (
  node: Pick<Node, 'type'>
) => node.type === 'frame'

export const isOwnerNode = (
  node: Pick<Node, 'type'>
) => node.type === 'group' || isContainerNode(node)

export const sanitizeGroupNode = (
  node: Node
): Node => {
  if (
    node.type !== 'group'
    || (
      node.position === undefined
      && node.size === undefined
      && node.rotation === undefined
    )
  ) {
    return node
  }

  const {
    position: _position,
    size: _size,
    rotation: _rotation,
    ...nextNode
  } = node

  return nextNode
}

const hasOwn = (target: object, key: keyof NodePatch) =>
  Object.prototype.hasOwnProperty.call(target, key)

export const sanitizeGroupPatch = (
  patch: NodePatch,
  type?: string
): NodePatch => {
  if ((patch.type ?? type) !== 'group') {
    return patch
  }

  if (
    !hasOwn(patch, 'position')
    && !hasOwn(patch, 'size')
    && !hasOwn(patch, 'rotation')
  ) {
    return patch
  }

  const {
    position: _position,
    size: _size,
    rotation: _rotation,
    ...nextPatch
  } = patch

  return nextPatch
}

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
    if (node.type === 'group') {
      return
    }

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

export const getContainerChildrenMap = (
  nodes: readonly Node[]
): Map<NodeId, Node[]> =>
  getOwnerChildrenMap(nodes, isContainerNode)

export const getContainerDescendants = (
  nodes: readonly Node[],
  containerId: NodeId
): Node[] => getOwnerDescendants(nodes, containerId)

export const getGroupChildrenMap = <TNode extends OwnedNode>(
  nodes: readonly TNode[]
): Map<NodeId, TNode[]> =>
  getOwnerChildrenMap(nodes, (node) => node.type === 'group')

export const getGroupDescendants = <TNode extends OwnedNode>(
  nodes: readonly TNode[],
  groupId: NodeId
): TNode[] => getOwnerDescendants(nodes, groupId)

export const findGroupAncestor = <
  TNode extends Pick<Node, 'id' | 'type'>
>(
  nodeId: NodeId,
  readNode: (nodeId: NodeId) => TNode | undefined,
  readOwnerId: (nodeId: NodeId) => NodeId | undefined,
  match?: (groupId: NodeId, group: TNode) => boolean
): NodeId | undefined => findOwnerAncestor(
  nodeId,
  readNode,
  readOwnerId,
  (ownerId, owner) => (
    owner.type === 'group'
    && (!match || match(ownerId, owner))
  )
)

export const expandGroupMembers = <TNode extends OwnedNode>(
  nodes: readonly TNode[],
  rootIds: readonly NodeId[]
): TNode[] => {
  if (!rootIds.length) {
    return []
  }

  const nodesById = new Map(nodes.map((node) => [node.id, node]))
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

    getOwnerDescendants(nodes, root.id).forEach((child) => {
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
