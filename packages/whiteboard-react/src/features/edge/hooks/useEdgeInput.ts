import { useCallback, type RefObject } from 'react'
import { useInternalInstance } from '../../../runtime/hooks'
import type { SelectedEdgePathPointView } from './useEdgeView'
import { useEdgeConnectInput } from './useEdgeConnectInput'
import { useEdgeDragInput } from './useEdgeDragInput'
import { useEdgePathInput } from './useEdgePathInput'

export const useEdgeInput = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const instance = useInternalInstance()
  const connect = useEdgeConnectInput({
    containerRef
  })
  const drag = useEdgeDragInput()
  const path = useEdgePathInput()

  const handleCanvasPointerDown = useCallback((
    container: HTMLDivElement,
    event: PointerEvent
  ) => {
    if (connect.handleCanvasPointerDown(container, event)) {
      return true
    }

    if (
      event.defaultPrevented
      || event.button !== 0
      || !instance.read.tool.is('select')
    ) {
      return false
    }

    const input = instance.read.pick.from(event, container)
    const capture = input.element ?? container
    const pick = input.pick

    if (pick.kind !== 'edge') {
      return false
    }

    if (pick.part === 'body') {
      return drag.handlePointerDown(event, pick.id, capture)
    }

    if (pick.part === 'end' && pick.end) {
      return connect.handleEndpointPointerDown(event, pick.id, pick.end, capture)
    }

    if (pick.part === 'path') {
      const point: SelectedEdgePathPointView =
        pick.index === undefined
          ? {
              key: `${pick.id}:insert:${pick.insert ?? 0}`,
              kind: 'insert',
              edgeId: pick.id,
              insertIndex: pick.insert ?? 0,
              point: input.point.world,
              active: false
            }
          : {
              key: `${pick.id}:anchor:${pick.index}`,
              kind: 'anchor',
              edgeId: pick.id,
              index: pick.index,
              point: input.point.world,
              active: false
            }

      return path.handlePointerDown(event, point, capture)
    }

    return false
  }, [connect, drag, instance, path])

  return {
    handleCanvasPointerDown,
    handlePathPointKeyDown: path.handlePathPointKeyDown
  }
}
