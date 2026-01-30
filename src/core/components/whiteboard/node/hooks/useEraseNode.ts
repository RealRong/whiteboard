import { WhiteboardStateAtom } from '@/core/components/whiteboard/hooks/useWhiteboardState'
import { IWhiteboardNode } from '~/typings'
import { selectAtom } from 'jotai/utils'
import { useAtomValue } from 'jotai'
import { useWhiteboardInstance } from '@/core/components/whiteboard/hooks'
import { isEqual } from 'lodash'

const stateAtom = selectAtom(
  WhiteboardStateAtom,
  s => ({
    isErasing: s.isErasing,
    erased: s.erasedNodes
  }),
  isEqual
)

const defaultState = {
  erased: undefined,
  isErasing: false
}
const useEraseNode = (node: IWhiteboardNode) => {
  const instance = useWhiteboardInstance()
  const state = node.type === 'freehand' ? useAtomValue(stateAtom) : defaultState
  const handlePointerEvent = () => {
    instance.nodeOps?.erase?.(node.id)
  }
  return {
    isErased: state.erased?.has(node.id),
    handlePointerEvent,
    isErasing: state.isErasing
  }
}

export default useEraseNode
