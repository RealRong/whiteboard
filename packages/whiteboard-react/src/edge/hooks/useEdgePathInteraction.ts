import { useCallback } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Edge, Point } from '@whiteboard/core/types'
import { useInstance } from '../../common/hooks'

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
    (
      event: ReactPointerEvent<SVGPathElement>,
      edge: Edge,
      pathPoints: Point[]
    ) => {
      if (event.button !== 0) return
      if (instance.render.read('spacePressed')) return

      const pointWorld = toPointerWorld(
        event.clientX,
        event.clientY,
        instance.query.viewport.clientToScreen,
        instance.query.viewport.screenToWorld
      )

      if (event.shiftKey || event.detail >= 2) {
        const segmentIndex = instance.query.geometry.nearestEdgeSegment(
          pointWorld,
          pathPoints
        )
        instance.commands.edge.insertRoutingPoint(
          edge,
          pathPoints,
          segmentIndex,
          pointWorld
        )
      }

      instance.commands.edge.select(edge.id)
      event.preventDefault()
      event.stopPropagation()
    },
    [instance]
  )

  return {
    handleEdgePathPointerDown
  }
}

