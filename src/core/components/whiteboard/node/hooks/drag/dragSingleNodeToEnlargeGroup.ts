import { Box, IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { getBoxOfBoxes } from '@/core/components/whiteboard/utils'
import { isEqual } from 'lodash'

const defaultEnlarge = 36
export default (node: IWhiteboardNode, instance: IWhiteboardInstance, availableGroups: (IWhiteboardNode & { type: 'group' })[]) => {
  let nodeBox: Box | undefined = undefined
  if (node.type === 'mindmap') {
    const allNodes = [node, ...(instance.mindmapOps?.expandMindmap(node) || [])]
    const allBoxes = allNodes.map(i => instance.nodeOps?.getNodeFuncs(i.id)?.getRealtimeBox()).filter(i => i) as Box[]
    nodeBox = getBoxOfBoxes(allBoxes)
  } else {
    nodeBox = instance.nodeOps?.getNodeFuncs(node.id)?.getRealtimeBox()
  }
  if (!nodeBox) return
  const newGroups = availableGroups
    .map(g => {
      const groupBox = instance.nodeOps?.getNodeFuncs(g.id)?.getRealtimeBox()
      if (groupBox) {
        const expanded = expandParentBox(groupBox, nodeBox, defaultEnlarge)
        if (!isEqual(expanded, groupBox)) {
          return {
            ...expanded,
            id: g.id
          }
        }
      }
    })
    .filter(i => i) as (Box & { id: number })[]
  if (newGroups.length) {
    instance.updateWhiteboard?.(w => {
      const groupSizes: IWhiteboardNode[] = []
      newGroups.forEach(g => {
        const origin = w.nodes?.get(g.id)
        if (origin) {
          const newOrigin = {
            ...origin,
            x: g.left,
            y: g.top,
            width: g.width,
            height: g.height
          }
          w.nodes?.set(g.id, newOrigin)
          groupSizes.push(newOrigin)
        }
      })
      instance.emit?.({
        type: 'nodeResized',
        resized: groupSizes
      })
    }, true)
  }
}

function expandParentBox(parentBox: Box, childBox: Box, distance: number) {
  let { left: pLeft, top: pTop, width: pWidth, height: pHeight } = parentBox
  let { left: cLeft, top: cTop, width: cWidth, height: cHeight } = childBox

  let pRight = pLeft + pWidth
  let pBottom = pTop + pHeight
  let cRight = cLeft + cWidth
  let cBottom = cTop + cHeight

  // 计算扩展的新边界
  let newLeft = Math.min(pLeft, cLeft - distance)
  let newTop = Math.min(pTop, cTop - distance)
  let newRight = Math.max(pRight, cRight + distance)
  let newBottom = Math.max(pBottom, cBottom + distance)

  // 计算新的宽高
  let newWidth = newRight - newLeft
  let newHeight = newBottom - newTop

  return { left: newLeft, top: newTop, width: newWidth, height: newHeight }
}
