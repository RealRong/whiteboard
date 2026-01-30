import { IWhiteboardInstance, IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import produce from 'immer'
import { deleteChildsFromTree, flattenTree, getChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'
import Id from '@/utils/id'

export const removeFromTree = (tree: IWhiteboardMindmap[], id: number, onRemove?: (n: IWhiteboardMindmap) => void) => {
  tree.forEach((t, idx) => {
    if (t.root === id) {
      tree.splice(idx, 1)
      onRemove?.(t)
    } else {
      removeFromTree(t.children, id, onRemove)
    }
  })
}

export const addToTree = (tree: IWhiteboardMindmap, id: number, idx: number | undefined, node: IWhiteboardMindmap) => {
  if (tree.root === id) {
    if (idx === undefined) {
      const length = tree.children.length
      tree.children.splice(length, 0, node)
    } else {
      tree.children.splice(idx, 0, node)
    }
  } else {
    tree.children.forEach(t => {
      addToTree(t, id, idx, node)
    })
  }
}

export const findDragIndex = (
  dragNode: IWhiteboardNode,
  root: { children: IWhiteboardMindmap[]; root: number },
  targetId: number,
  instance: IWhiteboardInstance
) => {
  const findTarget = (t: typeof root) => {
    if (t.root === targetId) {
      return t
    }
    for (const i of t.children) {
      if (i.root === targetId) {
        return i
      }
      const tar = findTarget(i)
      if (tar) {
        return tar
      }
    }
  }
  const target = findTarget(root) as IWhiteboardMindmap | undefined
  if (target) {
    const dragMidY = dragNode.y + dragNode.height! / 2
    if (!target.children.length) {
      return 0
    }
    const first = target.children[0]
    const last = target.children[target.children.length - 1]
    const firstNode = instance.getNode?.(first.root)
    if (firstNode && dragMidY < firstNode.y + firstNode.height! / 2) return 0
    const lastNode = instance.getNode?.(last.root)
    if (lastNode && dragMidY > lastNode.y + lastNode.height! / 2) {
      return target.children.length
    }
    const idx = target.children.findLastIndex((i, idx) => {
      const node = instance.getNode?.(i.root)
      if (node) {
        const mid = node.y + node.height! / 2
        console.log(mid, dragNode, dragMidY, idx)
        if (dragMidY > mid) {
          return true
        }
      }
      return false
    })
    if (idx >= 0) {
      return idx + 1
    }
    return -1
  }
}

export const findSubChildren = (children: IWhiteboardMindmap[], id: number): IWhiteboardMindmap[] | undefined => {
  for (const c of children) {
    if (c.root === id) {
      return c.children
    }
    const result = findSubChildren(c.children, id)
    if (result) {
      return result
    }
  }
}
