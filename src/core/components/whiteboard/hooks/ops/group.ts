import { Box, IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { assignProperties, boxContain, calculateImageAspectRatio, downloadImg } from '@/utils'
import { getBoxOfBoxes, getBoxOfNodes } from '@/core/components/whiteboard/utils'
import { exportWhiteboardAsImage } from '@/core/components/whiteboard/utils/exportAsImage'
import groupStore from '@/api/stores/group.store'

export const enlargeBox = (currentBox: Box, enlarge: number = 36) => {
  return {
    left: currentBox.left - enlarge,
    top: currentBox.top - enlarge,
    width: currentBox.width + 2 * enlarge,
    height: currentBox.height + 2 * enlarge
  }
}
const near = (a?: number, b?: number) => a !== undefined && b !== undefined && Math.abs(a - b) < 1
const assignGroupOps = (instance: IWhiteboardInstance) => {
  assignProperties(instance, {
    groupOps: {
      exportGroupImage: groupId => {
        const group = instance.getNode?.(groupId)
        const parent = instance.getContainerNode?.()
        if (group && parent) {
          exportWhiteboardAsImage([group], parent, instance).then(i => {
            downloadImg(i, `${group.name || 'group'}.png`)
          })
        }
      },
      getParentGroupsOfNode: (nodeId, mindmapChildUseRoot) => {
        const currentNode = instance.getNode?.(nodeId)
        if (!currentNode) throw 'Failed to find node!'
        const allNodes = instance.getAllNode?.()
        if (!allNodes) throw 'Failed to get all nodes!'
        const currentBox = {
          left: currentNode.x,
          top: currentNode.y,
          width: currentNode.width,
          height: currentNode.height
        }
        const rootBox = mindmapChildUseRoot && currentNode.rootId && instance.nodeOps?.getNodeFuncs(currentNode.rootId)?.getRealtimeBox()
        return allNodes.filter(i => {
          if (i.type === 'group' && i.id !== nodeId) {
            const groupBox = instance.nodeOps?.getNodeFuncs(i.id)?.getRealtimeBox()
            if (!groupBox) return false
            return boxContain(groupBox, currentBox) || (mindmapChildUseRoot && rootBox && boxContain(groupBox, rootBox))
          }
          return false
        })
      },
      getNodesInGroup: (groupNodeId, includeSelf = false, mindmapChildUseRoot = false) => {
        const group = instance.getNode?.(groupNodeId)
        if (!group) throw new Error('Can not find node!')
        const allNodes = instance.getAllNode?.()
        if (!allNodes) throw new Error('Can not find node!')
        const gb = instance.nodeOps?.getNodeFuncs(group.id)?.getRealtimeBox()
        if (!gb) throw new Error('Can not get group box!')
        return allNodes.filter(i => {
          if (includeSelf && i.id === groupNodeId) return true
          if (!includeSelf && i.id === groupNodeId) return false
          const b = {
            left: i.x,
            top: i.y,
            width: i.width,
            height: i.height
          }
          if (i.rootId && mindmapChildUseRoot) {
            // contains self
            if (boxContain(gb, b)) return true
            const root = instance.nodeOps?.getDOMBoxOfNodes(i.rootId)
            if (root) {
              const rootBox = root[i.rootId]
              // contains root
              return boxContain(gb, rootBox)
            }
            return false
          }
          return boxContain(gb, b)
        })
      },
      groupNodes: nodeId => {
        const idArr = Array.isArray(nodeId) ? nodeId : [nodeId]
        const nodes = idArr.map(i => instance.getNode?.(i)).filter(i => i) as IWhiteboardNode[]
        if (nodes.length) {
          const box = getBoxOfNodes(nodes)
          if (box) {
            const enlarged = enlargeBox(box)
            const ifAlreadyHasGroup = instance
              .getAllNode?.()
              .some(
                i =>
                  i.type === 'group' &&
                  near(i.x, enlarged.left) &&
                  near(i.y, enlarged.top) &&
                  near(i.width, enlarged.width) &&
                  near(i.height, enlarged.height)
              )
            if (ifAlreadyHasGroup) return
            instance.insertNode?.({
              type: 'group',
              x: enlarged.left,
              y: enlarged.top,
              width: enlarged.width,
              height: enlarged.height
            })
          }
        }
      }
    }
  })
}

export default assignGroupOps
