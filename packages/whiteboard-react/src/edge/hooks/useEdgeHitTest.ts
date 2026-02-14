import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useInstance } from '../../common/hooks'

export const useEdgeHitTest = () => {
  const instance = useInstance()
  const selectEdge = instance.commands.edge.select
  const insertPointAtClient = instance.commands.edge.insertRoutingPointAtClient

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
