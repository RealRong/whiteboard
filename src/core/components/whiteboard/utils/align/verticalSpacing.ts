// 垂直平铺
import { IWhiteboardNode } from '~/typings'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'
import produce from 'immer'

export default (nodes: IWhiteboardNode[], spacing = 15): IWhiteboardNode[] => {
  const haveBoundingNodes = nodes.filter(i => i.x !== undefined && i.y !== undefined && i.width !== undefined && i.height !== undefined)
  // sort from left to right
  haveBoundingNodes.sort((b, a) => b.y - a.y)
  const outer = getBoxOfNodes(nodes)
  if (!outer) {
    throw new Error('Failed to get bounding of boxes!')
  }
  const newNodes = produce(haveBoundingNodes, draft => {
    draft.forEach((node, idx, arr) => {
      const ifFirst = idx === 0
      if (!ifFirst) {
        const prev = arr[idx - 1]
        node.x = outer.left
        node.y = prev.y + prev.height + spacing
      } else {
        node.x = outer.left
      }
    })
  })
  return newNodes
}
