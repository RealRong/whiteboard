import type { Node, NodeId } from '../types'

const EMPTY_NODES: Node[] = []

const getCollapsedGroupIds = (nodes: Node[]) => {
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

const isHiddenByCollapsedGroup = (
  node: Node,
  nodeMap: Map<NodeId, Node>,
  collapsedGroupIds: Set<NodeId>
) => {
  let parentId = node.parentId
  while (parentId) {
    if (collapsedGroupIds.has(parentId)) return true
    const parent = nodeMap.get(parentId)
    parentId = parent?.parentId
  }
  return false
}

export const deriveVisibleNodes = (viewNodes: Node[]) => {
  if (!viewNodes.length) return EMPTY_NODES
  const nodeMap = new Map<NodeId, Node>(viewNodes.map((node) => [node.id, node]))
  const collapsedGroupIds = getCollapsedGroupIds(viewNodes)
  const hiddenNodeIds = new Set<NodeId>()

  viewNodes.forEach((node) => {
    if (isHiddenByCollapsedGroup(node, nodeMap, collapsedGroupIds)) {
      hiddenNodeIds.add(node.id)
    }
  })

  return viewNodes.filter((node) => !hiddenNodeIds.has(node.id))
}

export const deriveCanvasNodes = (visibleNodes: Node[]) =>
  visibleNodes.filter((node) => node.type !== 'mindmap')
