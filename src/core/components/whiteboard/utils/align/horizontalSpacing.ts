// 水平平铺
import { IWhiteboardNode } from '~/typings'
import produce from 'immer'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'

export default (nodes: IWhiteboardNode[], spacing = 15): IWhiteboardNode[] => {
  const haveBoundingNodes = nodes.filter(i => i.x !== undefined && i.y !== undefined && i.width !== undefined && i.height !== undefined)
  // sort from left to right
  haveBoundingNodes.sort((b, a) => b.x - a.x)
  const outer = getBoxOfNodes(nodes)
  if (!outer) {
    throw new Error('Failed to get bounding of boxes!')
  }
  const newNodes = produce(haveBoundingNodes, draft => {
    draft.forEach((node, idx, arr) => {
      const ifFirst = idx === 0
      if (!ifFirst) {
        const prev = arr[idx - 1]
        node.x = prev.x + prev.width + spacing
        node.y = outer.top
      } else {
        node.y = outer.top
      }
    })
  })
  return newNodes
}
