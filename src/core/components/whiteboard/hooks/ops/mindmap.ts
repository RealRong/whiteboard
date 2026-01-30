import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { assignProperties } from '@/utils'
import { flattenTree } from '@/core/components/whiteboard/node/mindmap/utils/tree'

export default function assignMindmapOps(instance: IWhiteboardInstance) {
  assignProperties(instance, {
    mindmapOps: {
      ...instance.mindmapOps,
      updateMindmapEdges: nodeId => {
        instance.nodeOps?.getNodeFuncs(nodeId)?.drawMindmapEdges?.()
      },
      expandMindmap: node => {
        const children: IWhiteboardNode[] = []
        if (node.rightChildren) {
          const flattened = flattenTree(node.rightChildren)
          flattened.forEach(r => {
            const n = instance.getNode?.(r.root)
            if (n) {
              children.push(n)
            }
          })
        }
        if (node.leftChildren) {
          const flattened = flattenTree(node.leftChildren)
          flattened.forEach(r => {
            const n = instance.getNode?.(r.root)
            if (n) {
              children.push(n)
            }
          })
        }
        return children
      }
    }
  })
}
