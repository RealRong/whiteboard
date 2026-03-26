import { useCallback, type RefObject } from 'react'
import type {
  EdgeCreateDown,
  EdgeDown
} from '../../../runtime/input/pointer'
import { useEdgeConnectInput } from './useEdgeConnectInput'
import { useEdgeDragInput } from './useEdgeDragInput'
import { useEdgeRouteInput } from './useEdgeRouteInput'

export const useEdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const connect = useEdgeConnectInput({
    containerRef
  })
  const drag = useEdgeDragInput()
  const route = useEdgeRouteInput()

  const create = useCallback((input: EdgeCreateDown) => (
    connect.create(input)
  ), [connect])

  const down = useCallback((input: EdgeDown) => {
    return (
      drag.down(input)
      || connect.reconnect(input)
      || route.down(input)
    )
  }, [connect, drag, route])

  return {
    create,
    down,
    keyDown: route.keyDown
  }
}
