import type { RefObject } from 'react'
import { useEdgeConnectInput } from './useEdgeConnectInput'
import { useEdgeDragInput } from './useEdgeDragInput'
import { useEdgePathInput } from './useEdgePathInput'

export const useEdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const connect = useEdgeConnectInput({
    containerRef
  })
  const drag = useEdgeDragInput()
  const path = useEdgePathInput()

  return {
    handleEdgePointerDown: drag.handleEdgePointerDown,
    handleEndpointPointerDown: connect.handleEndpointPointerDown,
    handlePathPointPointerDown: path.handlePathPointPointerDown,
    handlePathPointKeyDown: path.handlePathPointKeyDown
  }
}
