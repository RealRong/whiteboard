import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { getChildrenOfNode, getParentNodeOfNode, getSiblingNodesOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'

export default (
  currFocusedNode: IWhiteboardNode,
  instance: IWhiteboardInstance,
  direction: 'top' | 'right' | 'bottom' | 'left'
): IWhiteboardNode | undefined => {
  if (currFocusedNode.type === 'mindmap') {
    const rightChildren = currFocusedNode.rightChildren?.slice()
    const leftChildren = currFocusedNode.leftChildren?.slice()
    if (direction === 'top') {
      const first = rightChildren?.[0] || leftChildren?.[0]
      if (first) {
        return instance.getNode?.(first.root)
      }
    }
    if (direction === 'bottom') {
      const bottom = rightChildren?.pop() || leftChildren?.pop()
      if (bottom) {
        return instance.getNode?.(bottom.root)
      }
    }
    if (direction === 'left') {
      const first = leftChildren?.[0]
      if (first) {
        return instance.getNode?.(first.root)
      }
    }
    if (direction === 'right') {
      const first = rightChildren?.[0]
      if (first) {
        return instance.getNode?.(first.root)
      }
    }
    return
  }
  if (currFocusedNode.rootId) {
    const siblings = getSiblingNodesOfNode(currFocusedNode, instance)?.slice()
    if (siblings) {
      const idx = siblings.findIndex(i => i.root === currFocusedNode.id)
      if (direction === 'top') {
        const prev = idx === 0 ? siblings.pop() : siblings[idx - 1]
        return instance.getNode?.(prev.root)
      }
      if (direction === 'bottom') {
        const next = idx === siblings.length - 1 ? siblings[0] : siblings[idx + 1]
        return instance.getNode?.(next.root)
      }
      if (direction === 'left') {
        if (currFocusedNode.side === 'right') {
          const parent = getParentNodeOfNode(currFocusedNode, instance)
          if (parent) {
            return instance.getNode?.(parent.id)
          }
        }
        if (currFocusedNode.side === 'left') {
          if (currFocusedNode.collapseChildren) return currFocusedNode
          const children = getChildrenOfNode(currFocusedNode, instance, currFocusedNode.side)
          const firstChild = children?.[0]
          if (firstChild) {
            return instance.getNode?.(firstChild.root)
          }
        }
      }
      if (direction === 'right') {
        if (currFocusedNode.side === 'right') {
          if (currFocusedNode.collapseChildren) return currFocusedNode
          const children = getChildrenOfNode(currFocusedNode, instance, currFocusedNode.side)
          const firstChild = children?.[0]
          if (firstChild) {
            return instance.getNode?.(firstChild.root)
          }
        }
        if (currFocusedNode.side === 'left') {
          const parent = getParentNodeOfNode(currFocusedNode, instance)
          if (parent) {
            return instance.getNode?.(parent.id)
          }
        }
      }
    }

    return
  }
  return
}
