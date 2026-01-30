import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import autoArrangeLayout from '@/core/components/whiteboard/node/mindmap/autoArrangeLayout'
import handleAddSubNode from '@/core/components/whiteboard/node/mindmap/handleAddSubNode'
import { getFlattenChildrenOfNode } from '@/core/components/whiteboard/node/mindmap/utils/tree'

export default (
  defaultNode: Partial<IWhiteboardNode>,
  sourceNode: IWhiteboardNode,
  direction: 'right' | 'left',
  instance: IWhiteboardInstance,
  idx?: number
) => {
  const defaultWidth = 100
  let defaultHeight = 34.6875
  if (defaultNode.borderType && defaultNode.borderType !== 'underline') {
    if (defaultNode.border) {
      defaultHeight += 6
    }
  }
  const newNode = {
    ...defaultNode,
    width: defaultWidth,
    height: defaultHeight
  }
  if (newNode.rootId) {
    const root = instance.getNode?.(newNode.rootId)
    if (root) {
      const rightIds = new Set(getFlattenChildrenOfNode(root, instance, 'right')?.map(i => i.root))
      const leftIds = new Set(getFlattenChildrenOfNode(root, instance, 'left')?.map(i => i.root))
      const newMindmap = handleAddSubNode({
        rightIds: rightIds,
        leftIds: leftIds,
        currNode: root,
        idx: idx ?? 0,
        direction,
        newNode: newNode,
        targetId: sourceNode.id
      })
      if (newMindmap) {
        const layout = autoArrangeLayout(newMindmap, instance, direction)
        const position = layout?.find(i => i.id === defaultNode.id)
        if (position) {
          newNode.x = position.x + root.x
          newNode.y = position.y + root.y
          console.log(root, position, newNode)
          return newNode
        }
      }
    }
  }
}
