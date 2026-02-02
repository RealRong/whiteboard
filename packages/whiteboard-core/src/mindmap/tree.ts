import type { NodeId } from '../types/core'

export type MindmapTreeNode<Id = NodeId> = {
  root: Id
  children: MindmapTreeNode<Id>[]
}

export const flattenTree = <Id = NodeId>(children: MindmapTreeNode<Id>[]) => {
  const nodes: MindmapTreeNode<Id>[] = []
  const loop = (node: MindmapTreeNode<Id>) => {
    nodes.push(node)
    node.children.forEach(loop)
  }
  children.forEach(loop)
  return nodes
}

export const findSubChildren = <Id = NodeId>(
  children: MindmapTreeNode<Id>[],
  id: Id
): MindmapTreeNode<Id>[] | undefined => {
  for (const child of children) {
    if (child.root === id) {
      return child.children
    }
    const result = findSubChildren(child.children, id)
    if (result) {
      return result
    }
  }
}

export const getSubChildren = <Id = NodeId>(
  root: MindmapTreeNode<Id>,
  id: Id
): MindmapTreeNode<Id>[] | undefined => {
  if (root.root === id) return root.children
  for (const child of root.children) {
    if (child.root === id) {
      return child.children
    }
    const result = getSubChildren(child, id)
    if (result) {
      return result
    }
  }
}

export const deleteChildrenFromTree = <Id = NodeId>(tree: MindmapTreeNode<Id>[], deleteNodeIds: Id | Id[]) => {
  const deleteIdSet = new Set(Array.isArray(deleteNodeIds) ? deleteNodeIds : [deleteNodeIds])
  const deletedNodes: MindmapTreeNode<Id>[] = []

  const traverse = (children: MindmapTreeNode<Id>[]): MindmapTreeNode<Id>[] => {
    return children
      .filter((child) => {
        if (deleteIdSet.has(child.root)) {
          deletedNodes.push(child)
          return false
        }
        return true
      })
      .map((child) => ({
        ...child,
        children: traverse(child.children)
      }))
  }

  return {
    result: traverse(tree),
    deletedNodes
  }
}

export const updateTree = <Id = NodeId>(
  tree: MindmapTreeNode<Id>[],
  sourceId: Id,
  targetId: Id,
  patch: Partial<MindmapTreeNode<Id>>
) => {
  const updateNode = (node: MindmapTreeNode<Id>): MindmapTreeNode<Id> => {
    if (node.root === targetId) {
      return {
        ...node,
        ...patch,
        children: patch.children ?? node.children
      }
    }
    if (node.root === sourceId) {
      const nextChildren = node.children.map((child) => {
        if (child.root === targetId) {
          return {
            ...child,
            ...patch,
            children: patch.children ?? child.children
          }
        }
        return child
      })
      return {
        ...node,
        children: nextChildren
      }
    }
    return {
      ...node,
      children: node.children.map(updateNode)
    }
  }

  return tree.map(updateNode)
}

// Mutates the tree in-place (aligned with legacy behavior).
export const removeFromTree = <Id = NodeId>(
  tree: MindmapTreeNode<Id>[],
  id: Id,
  onRemove?: (node: MindmapTreeNode<Id>) => void
) => {
  tree.forEach((node, index) => {
    if (node.root === id) {
      tree.splice(index, 1)
      onRemove?.(node)
    } else {
      removeFromTree(node.children, id, onRemove)
    }
  })
}

// Mutates the tree in-place (aligned with legacy behavior).
export const addToTree = <Id = NodeId>(
  tree: MindmapTreeNode<Id>,
  id: Id,
  idx: number | undefined,
  node: MindmapTreeNode<Id>
) => {
  if (tree.root === id) {
    if (idx === undefined) {
      const length = tree.children.length
      tree.children.splice(length, 0, node)
    } else {
      tree.children.splice(idx, 0, node)
    }
  } else {
    tree.children.forEach((child) => {
      addToTree(child, id, idx, node)
    })
  }
}
