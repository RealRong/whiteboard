import { useCallback } from 'react'
import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { distancePointToSegment } from '../../common/utils/geometry'
import { useInstance } from '../../common/hooks'

export const useEdgeHitTest = () => {
  const instance = useInstance()
  const containerRef = instance.runtime.containerRef
  const screenToWorld = instance.runtime.viewport.screenToWorld
  const selectEdge = instance.commands.edge.select
  const insertPoint = instance.commands.edge.insertRoutingPoint

  const getWorldPoint = useCallback(
    (event: { clientX: number; clientY: number; currentTarget: Element }) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      return screenToWorld(screenPoint)
    },
    [containerRef, screenToWorld]
  )

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

  const handlePathPointerDown =
    (edge: Edge, pathPoints: Point[]) => (event: ReactPointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      const pointWorld = getWorldPoint(event)
      if (event.shiftKey) {
        const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
        insertPoint(edge, pathPoints, segmentIndex, pointWorld)
        selectEdge(edge.id)
        return
      }
      selectEdge(edge.id)
    }

  const handlePathClick =
    (edge: Edge, pathPoints: Point[]) => (event: ReactMouseEvent<SVGPathElement>) => {
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      const pointWorld = getWorldPoint(event)
      const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
      insertPoint(edge, pathPoints, segmentIndex, pointWorld)
      selectEdge(edge.id)
    }

  return {
    handlePathPointerDown,
    handlePathClick
  }
}
