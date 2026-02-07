import { useCallback } from 'react'
import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react'
import { distancePointToSegment } from '../../common/utils/geometry'

type Options = {
  containerRef?: RefObject<HTMLElement | null>
  screenToWorld?: (point: Point) => Point
  onSelectEdge?: (id?: string) => void
  onInsertPoint?: (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => void
}

export const useEdgeHitTest = ({ containerRef, screenToWorld, onSelectEdge, onInsertPoint }: Options) => {
  const getWorldPoint = useCallback(
    (event: { clientX: number; clientY: number; currentTarget: Element }) => {
      if (screenToWorld && containerRef?.current) {
        const rect = containerRef.current.getBoundingClientRect()
        const screenPoint = { x: event.clientX - rect.left, y: event.clientY - rect.top }
        return screenToWorld(screenPoint)
      }
      const rect = event.currentTarget.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
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
      if (!pointWorld) return
      if (event.shiftKey && onInsertPoint) {
        const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
        onInsertPoint(edge, pathPoints, segmentIndex, pointWorld)
        onSelectEdge?.(edge.id)
        return
      }
      onSelectEdge?.(edge.id)
    }

  const handlePathClick =
    (edge: Edge, pathPoints: Point[]) => (event: ReactMouseEvent<SVGPathElement>) => {
      if (!onInsertPoint) return
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      const pointWorld = getWorldPoint(event)
      if (!pointWorld) return
      const segmentIndex = getSegmentIndexOnPath(pointWorld, pathPoints)
      onInsertPoint(edge, pathPoints, segmentIndex, pointWorld)
      onSelectEdge?.(edge.id)
    }

  return {
    handlePathPointerDown,
    handlePathClick
  }
}
