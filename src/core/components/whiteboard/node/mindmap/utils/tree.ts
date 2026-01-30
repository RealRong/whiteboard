import { IWhiteboardInstance, IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import produce from 'immer'

export const deleteChildsFromTree = (tree: IWhiteboardMindmap[], deleteNodeIds: number | number[]) => {
  const deleteIdSet = new Set(Array.isArray(deleteNodeIds) ? deleteNodeIds : [deleteNodeIds])
  const deletedNodes: IWhiteboardMindmap[] = []
  const traverse = (node: IWhiteboardMindmap) => {
    if (!node.children.length) return node.children
    let newChildren = node.children.filter(i => {
      if (deleteIdSet.has(i.root)) {
        deletedNodes.push(i)
        return false
      }
      return true
    })
    newChildren = newChildren.map(c => ({ ...c, root: c.root, children: traverse(c) }))
    return newChildren
  }
  const root = {
    children: tree,
    root: 0
  }
  return {
    result: traverse(root),
    deletedNodes
  }
}

export const updateTree = (tree: IWhiteboardMindmap[], sourceId: number, targetId: number, newMindmap: Partial<IWhiteboardMindmap>) => {
  const newTree = produce(tree, draft => {
    const loop = (nodes: IWhiteboardMindmap[]) => {
      nodes.forEach(n => {
        if (n.root === targetId) {
          Object.assign(n, newMindmap)
        } else if (n.root === sourceId) {
          const target = n.children.find(i => i.root === targetId)
          if (target) {
            Object.assign(target, newMindmap)
          }
        } else {
          loop(n.children)
        }
      })
    }
    loop(draft)
  })
  return newTree
}
export const isSubChild = (one: number, maybeParent: number, instance: IWhiteboardInstance): boolean => {
  const sourceNode = instance.getNode?.(one)
  const targetNode = instance.getNode?.(maybeParent)
  if (!sourceNode || !targetNode) {
    return false
  }
  if (targetNode.type !== 'mindmap' && !targetNode.rootId) {
    return false
  }
  if (targetNode.type === 'mindmap') {
    const leftChildren = getFlattenChildrenOfNode(targetNode, instance, 'left')
    const rightChildren = getFlattenChildrenOfNode(targetNode, instance, 'right')
    if (leftChildren?.some(i => i.root === one) || rightChildren?.some(i => i.root === one)) {
      return true
    }
    return false
  }
  if (targetNode.rootId) {
    const children = getFlattenChildrenOfNode(targetNode, instance, targetNode.side)
    if (children?.some(i => i.root === one)) {
      return true
    }
    return false
  }
}
export const getSubChildren = (root: IWhiteboardMindmap, id: number): IWhiteboardMindmap[] | undefined => {
  if (root.root === id) return root.children
  for (const c of root.children) {
    if (c.root === id) {
      return c.children
    }
    const result = getSubChildren(c, id)
    if (result) {
      return result
    }
  }
}
export const flattenTree = (children: IWhiteboardMindmap[]) => {
  const nodes: IWhiteboardMindmap[] = []
  const loop = (c: IWhiteboardMindmap) => {
    nodes.push(c)
    c.children.forEach(i => loop(i))
  }
  children.forEach(c => loop(c))
  return nodes
}

const buildRootTree = (
  rootId: number,
  direction: 'right' | 'left',
  instance: IWhiteboardInstance
): Map<number, IWhiteboardMindmap> | undefined => {
  const node = instance.getNode?.(rootId)
  if (node) {
    const rightTreeWeakMap = instance.values.mindmapRightTreeWeakMap
    const leftTreeWeakMap = instance.values.mindmapLeftTreeWeakMap
    const alreadyMap = (direction === 'right' ? rightTreeWeakMap : leftTreeWeakMap).get(node)
    if (alreadyMap) return alreadyMap
    const children = (node as IWhiteboardNode & { type: 'mindmap' })[direction === 'right' ? 'rightChildren' : 'leftChildren']
    if (children) {
      const flattened = flattenTree(children)
      const m = new Map(flattened.map(i => [i.root, i]))
      ;(direction === 'right' ? rightTreeWeakMap : leftTreeWeakMap).set(node, m)
      return m
    }
  }
}

export const getFlattenChildrenOfNode = (node: IWhiteboardNode, instance: IWhiteboardInstance, direction?: 'right' | 'left') => {
  const children = getChildrenOfNode(node, instance, direction)
  if (children) {
    const childrenToFlattenChildren = instance.values.mindmapChildrenToFlattenChildren
    const alreadyChildren = childrenToFlattenChildren.get(children)
    if (alreadyChildren) return alreadyChildren
    const flattened = flattenTree(children)
    childrenToFlattenChildren.set(children, flattened)
    return flattened
  }
}
export const getChildrenOfNode = (node: IWhiteboardNode, instance: IWhiteboardInstance, direction?: 'right' | 'left') => {
  if (node.type === 'mindmap') {
    if (direction === 'right') {
      return node.rightChildren
    }
    return node.leftChildren
  }
  if (node.rootId) {
    try {
      const treeMap = buildRootTree(node.rootId, node.side ?? 'right', instance)
      if (treeMap) {
        return treeMap.get(node.id)?.children
      }
    } catch (e) {
      console.log(e)
    }
  }
}

export const getSiblingNodesOfNode = (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  if (!node.rootId) {
    return
  }
  const root = instance.getNode?.(node.rootId)
  if (root && root.type === 'mindmap') {
    const rootNodes = node.side === 'right' ? root.rightChildren : root.leftChildren
    if (rootNodes) {
      let ns: undefined | IWhiteboardMindmap[] = undefined
      const loop = (nodes: IWhiteboardMindmap[]) => {
        if (nodes.some(i => i.root === node.id)) {
          ns = nodes
          return true
        }
        nodes.find(n => loop(n.children))
      }
      loop(rootNodes)
      return ns
    }
  }
}

export const getParentNodeOfNode = (node: IWhiteboardNode, instance: IWhiteboardInstance) => {
  if (!node.rootId) {
    return
  }
  const root = instance.getNode?.(node.rootId)
  if (root && root.type === 'mindmap') {
    const rootNodes = node.side === 'right' ? root.rightChildren : root.leftChildren
    if (rootNodes) {
      if (rootNodes.some(i => i.root === node.id)) {
        return {
          id: root.id,
          children: rootNodes
        }
      }
      let ns: undefined | IWhiteboardMindmap = undefined
      const loop = (nodes: IWhiteboardMindmap[]) => {
        const target = nodes.find(i => i.children.some(c => c.root === node.id))
        if (target) {
          ns = target
          return
        }
        nodes.find(n => loop(n.children))
      }
      loop(rootNodes)
      if (ns) {
        return {
          id: ns.root,
          children: ns.children
        }
      }
    }
  }
}
