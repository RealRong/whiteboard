import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Edge, Point } from '@whiteboard/core/types'
import { useInternalInstance as useInstance } from '../../common/hooks'

const toPointerWorld = (
  clientX: number,
  clientY: number,
  clientToScreen: (clientX: number, clientY: number) => Point,
  screenToWorld: (screen: Point) => Point
) => {
  const screen = clientToScreen(clientX, clientY)
  return screenToWorld(screen)
}

export const useEdgePathInteraction = () => {
  const instance = useInstance()

  const handleEdgePathPointerDown = useCallback(
    (event: ReactPointerEvent<SVGPathElement>, edge: Edge) => {
      if (event.button !== 0) return

      const pointWorld = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.viewport.clientToScreen,
        instance.viewport.screenToWorld
      )

      if (event.shiftKey || event.detail >= 2) {
        instance.commands.edge.routing.insertAtPoint(edge.id, pointWorld)
      }

      instance.commands.selection.selectEdge(edge.id)
      event.preventDefault()
      event.stopPropagation()
    },
    [instance]
  )

  return {
    handleEdgePathPointerDown
  }
}
