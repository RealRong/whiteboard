import type { MindmapNodeId, MindmapTree } from './types'

export const getChildrenIds = (tree: MindmapTree, nodeId: MindmapNodeId) => tree.children[nodeId] ?? []

export const getParentId = (tree: MindmapTree, nodeId: MindmapNodeId) => tree.nodes[nodeId]?.parentId

export const getSiblings = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const parentId = getParentId(tree, nodeId)
  if (!parentId) return []
  return (tree.children[parentId] ?? []).filter((id) => id !== nodeId)
}

export const getPathToRoot = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const path: MindmapNodeId[] = []
  let current: MindmapNodeId | undefined = nodeId
  const guard = new Set<MindmapNodeId>()
  while (current) {
    if (guard.has(current)) break
    guard.add(current)
    path.push(current)
    current = tree.nodes[current]?.parentId
  }
  return path
}

export const getDepth = (tree: MindmapTree, nodeId: MindmapNodeId) => {
  const path = getPathToRoot(tree, nodeId)
  return Math.max(0, path.length - 1)
}

export const isAncestor = (tree: MindmapTree, ancestorId: MindmapNodeId, nodeId: MindmapNodeId) => {
  let current = tree.nodes[nodeId]?.parentId
  while (current) {
    if (current === ancestorId) return true
    current = tree.nodes[current]?.parentId
  }
  return false
}

export const getSubtreeIds = (tree: MindmapTree, rootId: MindmapNodeId) => {
  const result: MindmapNodeId[] = []
  const stack: MindmapNodeId[] = [rootId]
  const visited = new Set<MindmapNodeId>()
  while (stack.length) {
    const current = stack.pop()!
    if (visited.has(current)) continue
    visited.add(current)
    result.push(current)
    const children = tree.children[current] ?? []
    children.forEach((childId) => stack.push(childId))
  }
  return result
}

export const getSide = (tree: MindmapTree, nodeId: MindmapNodeId): 'left' | 'right' | undefined => {
  if (nodeId === tree.rootId) return
  let current: MindmapNodeId | undefined = nodeId
  while (current) {
    const parent = tree.nodes[current]?.parentId
    if (!parent) return
    if (parent === tree.rootId) {
      return tree.nodes[current]?.side
    }
    current = parent
  }
}
