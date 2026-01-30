import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import contextMenuHandler from '@/core/components/whiteboard/node/hooks/contextMenuHandler'
import { NodeInnerState } from '@/core/components/whiteboard/node/WrapperNode'
import pointerHandler from '@/core/components/whiteboard/node/hooks/pointerHandler'
import { Dispatch, SetStateAction } from 'react'

export default (opts: {
  element: HTMLElement
  node: IWhiteboardNode
  instance: IWhiteboardInstance
  nodeState: NodeInnerState
  isDraggingNode: boolean
  setNodeState: Dispatch<SetStateAction<Partial<NodeInnerState>>>
}) => {
  const { element, node, instance, nodeState, isDraggingNode } = opts
  const { handleContextMenuFunc, returnContextMenuFunc } = contextMenuHandler(element, node, instance)
  const { handlePointerFunc, returnPointerFunc } = pointerHandler(opts)
  const handleFunc = () => {
    handleContextMenuFunc()
    handlePointerFunc()
  }

  const returnFunc = () => {
    returnContextMenuFunc()
    returnPointerFunc()
  }

  return {
    handleFunc,
    returnFunc
  }
}
