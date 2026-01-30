import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { flextree, FlextreeNode } from 'd3-flextree'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'
import Hierarchy from '@antv/hierarchy'

export default (node: IWhiteboardNode & { type: 'mindmap' }, instance: IWhiteboardInstance, direction: 'right' | 'left') => {
  const children = direction === 'right' ? node.rightChildren : node.leftChildren
  if (direction === 'right' && node.rightCollapse) return
  if (direction === 'left' && node.leftCollapse) return
  const normalized = {
    ...node,
    root: node.id,
    children
  }
  const rootNode = Hierarchy.mindmap(normalized, {
    getSide(d) {
      return direction
    },
    direction: 'H',
    getHeight: d => {
      const id = d.root
      const size = instance.nodeOps?.getNodeFuncs?.(id)?.getRealtimeBox()
      return size?.height ?? 0
    },
    getWidth: d => {
      const id = d.root
      const size = instance.nodeOps?.getNodeFuncs?.(id)?.getRealtimeBox()
      return size?.width ?? 0
    },
    getHGap: () => 100,
    getVGap: () => 12,
    getSubTreeSep(d) {
      return 0
      // if (!d.children || !d.children.length) {
      //   return 0
      // }
      // return 40
    }
  })
  const nodes: {
    id: number
    x: number
    y: number
  }[] = []
  rootNode.eachNode(n => {
    nodes.push({
      id: n.data.root,
      x: n.x - rootNode.x,
      y: n.y - rootNode.y
    })
  })
  return nodes
}
