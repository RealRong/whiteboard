import { useCallback, type RefObject } from 'react'
import type { CanvasDown } from '../../../runtime/input/down'
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

  const create = useCallback((input: CanvasDown) => (
    connect.create(input)
  ), [connect])

  const down = useCallback((input: CanvasDown) => {
    if (input.event.defaultPrevented || input.event.button !== 0) {
      return false
    }

    if (input.mode !== 'idle' || input.tool.type !== 'select') {
      return false
    }

    return (
      drag.down(input)
      || connect.reconnect(input)
      || path.down(input)
    )
  }, [connect, drag, path])

  return {
    create,
    down,
    keyDown: path.keyDown
  }
}
