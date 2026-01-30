import { IWhiteboardMindmap, IWhiteboardNode } from '~/typings'
import produce from 'immer'
import { removeFromTree } from '@/core/components/whiteboard/node/mindmap/drag/handleNodeDragEnd'

export default (result: { node: IWhiteboardNode & { type: 'mindmap' }; targetNodeId: number; side: 'left' | 'right' }) => {
  const { node, targetNodeId, side } = result
  const newNode = produce(node, draft => {
    if (side === 'right' && draft.rightChildren?.length) {
      removeFromTree(draft.rightChildren, targetNodeId)
    }
    if (side === 'left' && draft.leftChildren?.length) {
      removeFromTree(draft.leftChildren, targetNodeId)
    }
  })
  return newNode
}
