import { useCallback } from 'react'
import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { distancePointToSegment } from '../../common/utils/geometry'
import { useInstance } from '../../common/hooks'

export const useEdgeHitTest = () => {
  const instance = useInstance()
  const clientToScreen = instance.runtime.viewport.clientToScreen
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const selectEdge = instance.commands.edge.select
  const insertPoint = instance.commands.edge.insertRoutingPoint

  const getSegmentIndexOnPath = useCallback((pointWorld: Point, pathPoints: Point[]) => {
    let min = Number.POSITIVE_INFINITY
    let minIndex = Math.max(0, pathPoints.length - 2)
    for (let i = 0; i < pathPoints.length - 1; i += 1) {
      const d = distancePointToSegment(pointWorld, pathPoints[i], pathPoints[i + 1])
      if (d < min) {
        min = d
        minIndex = i
      }
    }
    return minIndex
  }, [])

  const insertPointAtClient = useCallback(
    (edge: Edge, pathPoints: Point[], clientX: number, clientY: number) => {
      const pointWorld = screenToWorld(clientToScreen(clientX, clientY))
      const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
      insertPoint(edge, pathPoints, segmentIndex, pointWorld)
      selectEdge(edge.id)
    },
    [clientToScreen, getSegmentIndexOnPath, insertPoint, screenToWorld, selectEdge]
  )

  const handlePathPointerDown =
    (edge: Edge, pathPoints: Point[]) => (event: ReactPointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
        return
      }
      selectEdge(edge.id)
    }

  const handlePathClick =
    (edge: Edge, pathPoints: Point[]) => (event: ReactMouseEvent<SVGPathElement>) => {
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
    }

  return {
    handlePathPointerDown,
    handlePathClick
  }
}
