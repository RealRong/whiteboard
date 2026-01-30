import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'
import { getChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'

export default (instance: IWhiteboardInstance, dragNodeId: number) => {
  const allNodes = instance.getAllNode?.()
  // 可以贴近的节点, 自己不能贴近自己，并且自己不能贴近自己的子节点
  const attachableNodes = allNodes?.filter(
    i => (i.type === 'mindmap' || i.rootId) && i.rootId !== dragNodeId && !i.collapse && i.id !== dragNodeId
  )
  if (!attachableNodes?.length) return
  const expanded = attachableNodes
    .map(ni => {
      const nodeBox = instance.nodeOps?.getNodeFuncs(ni.id)?.getRealtimeBox()
      if (!nodeBox) return
      const n = {
        ...ni,
        x: nodeBox.left,
        y: nodeBox.top,
        width: nodeBox.width,
        height: nodeBox.height
      }
      // todo: should get all nested subchildren
      if (n.type === 'mindmap' || n.rootId) {
        let rightBox = undefined
        let leftBox = undefined
        if (n.type === 'mindmap') {
          const rightChildren = n.rightChildren
          const leftChildren = n.leftChildren
          if (rightChildren?.length && !n.rightCollapse) {
            rightBox = getBoxOfBoxes(Object.values(instance.nodeOps?.getDOMBoxOfNodes(rightChildren.map(i => i.root)) || {}))
          }
          if (leftChildren?.length && !n.rightCollapse) {
            leftBox = getBoxOfBoxes(Object.values(instance.nodeOps?.getDOMBoxOfNodes(leftChildren.map(i => i.root)) || {}))
          }
        }
        if (n.rootId && !n.collapseChildren) {
          const children = getChildrenOfNode(n, instance, n.side)
          if (children?.length) {
            const box = getBoxOfBoxes(Object.values(instance.nodeOps?.getDOMBoxOfNodes(children.map(i => i.root)) || {}))
            n.side === 'right' ? (rightBox = box) : (leftBox = box)
          }
        }
        // 如果指针在此节点右侧，则通过rightbox扩展， 在左侧则通过leftbox扩展
        let minY = nodeBox.top
        let maxY = nodeBox.top + nodeBox.height
        if (rightBox) {
          minY = Math.min(rightBox.top, minY)
          maxY = Math.max(rightBox.top + rightBox.height, maxY)
        }
        if (leftBox) {
          minY = Math.min(minY, leftBox.top)
          maxY = Math.max(leftBox.top + leftBox.height, maxY)
        }
        n.y = minY
        n.height = maxY - minY
      }
      return n
    })
    .filter(i => i) as IWhiteboardNode[]
  instance.values.mindmapAttachableNodesCache = expanded
}
