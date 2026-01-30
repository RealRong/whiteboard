import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { assignProperties } from '@/utils'
import alignNode from '@/core/components/whiteboard/utils/align/alignNode'
import horizontalSpacing from '@/core/components/whiteboard/utils/align/horizontalSpacing'
import verticalSpacing from '@/core/components/whiteboard/utils/align/verticalSpacing'
import { getBoxOfNodes } from '@/core/components/whiteboard/utils'
import packBoxes from '@/core/components/whiteboard/utils/align/pack'

const assignLayoutOps = (instance: IWhiteboardInstance) => {
  assignProperties(instance, {
    layoutOps: {
      alignNodes: (nodes, alignment) => {
        const updated = alignNode(alignment, nodes)
        instance.updateWhiteboard(w => {
          updated.forEach(n => {
            w.nodes?.set(n.id, n)
          })
        }, true)
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        })
      },
      layoutNodes: (nodes, layout, spacing) => {
        switch (layout) {
          case 'horizontallySpacing': {
            const after = horizontalSpacing(nodes, spacing)
            instance.updateWhiteboard(w => {
              after.forEach(n => {
                w.nodes?.set(n.id, n)
              })
            }, true)
            break
          }
          case 'verticallySpacing': {
            const after = verticalSpacing(nodes, spacing)
            instance.updateWhiteboard(w => {
              after.forEach(n => {
                w.nodes?.set(n.id, n)
              })
            }, true)
            break
          }
        }
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        })
      },
      packNodes: (nodes, spacing = 30) => {
        const currentBox = getBoxOfNodes(nodes)
        if (!currentBox) return
        const boxesWithIds = nodes
          .filter(i => i.width && i.height)
          .map(i => ({ id: i.id, width: i.width + spacing, height: i.height + spacing }))
        packBoxes(boxesWithIds)
        instance.updateWhiteboard?.(w => {
          boxesWithIds.forEach(b => {
            const id = b.id
            const node = w.nodes?.get(id)
            if (node) {
              w.nodes?.set(id, { ...node, x: b.left + currentBox.left, y: b.top + currentBox.top })
            }
          })
        }, true)
        setTimeout(() => {
          instance.selectOps?.resetSelectionBox()
        })
      }
    }
  })
}
export default assignLayoutOps
