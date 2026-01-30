import { IWhiteboardInstance, IWhiteboardNode } from '~/typings'
import { NodeInnerState } from '@/core/components/whiteboard/node/WrapperNode'
import { Dispatch, SetStateAction } from 'react'

export default (opts: {
  element: HTMLElement
  node: IWhiteboardNode
  nodeState: NodeInnerState
  instance: IWhiteboardInstance
  isDraggingNode: boolean
  setNodeState: Dispatch<SetStateAction<Partial<NodeInnerState>>>
}) => {
  const { element, node, nodeState, instance, isDraggingNode, setNodeState } = opts
  const pointerHandler = (e: PointerEvent) => {
    if (e.type === 'pointerenter') {
      if (isDraggingNode && node.type === 'group') {
        setNodeState(s => ({ ...s, selected: true }))
      }
    }
    if (e.type === 'pointerleave') {
      if (isDraggingNode && node.type === 'group') {
        setNodeState(s => ({ ...s, selected: true }))
      }
    }
  }

  const handlePointerFunc = () => {
    element.addEventListener('pointerdown', pointerHandler)
    element.addEventListener('pointerup', pointerHandler)
    // element.addEventListener('pointerenter', pointerHandler)
    // element.addEventListener('pointerleave', pointerHandler)
  }

  const returnPointerFunc = () => {
    element.removeEventListener('pointerdown', pointerHandler)
    element.removeEventListener('pointerup', pointerHandler)
    // element.removeEventListener('pointerenter', pointerHandler)
    // element.removeEventListener('pointerleave', pointerHandler)
  }

  return {
    handlePointerFunc,
    returnPointerFunc
  }
}
