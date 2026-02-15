import type { Edge, Point } from '@whiteboard/core'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { useCallback } from 'react'
import { useInstance, useWhiteboardSelector, useWhiteboardView } from '../../common/hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'

export const EdgeLayer = () => {
  const instance = useInstance()
  const paths = useWhiteboardView('edge.paths')
  const stateSelectedEdgeId = useWhiteboardSelector('edgeSelection')
  const hitTestThresholdScreen = instance.runtime.config.edge.hitTestThresholdScreen
  const selectEdge = instance.commands.edge.select
  const insertPointAtClient = instance.commands.edge.insertRoutingPointAtClient

  const handlePathPointerDown = useCallback(
    (edge: Edge, pathPoints: Point[], event: ReactPointerEvent<SVGPathElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) {
        insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
        return
      }
      selectEdge(edge.id)
    },
    [insertPointAtClient, selectEdge]
  )

  const handlePathClick = useCallback(
    (edge: Edge, pathPoints: Point[], event: ReactMouseEvent<SVGPathElement>) => {
      if (event.detail < 2) return
      event.preventDefault()
      event.stopPropagation()
      insertPointAtClient(edge, pathPoints, event.clientX, event.clientY)
    },
    [insertPointAtClient]
  )

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <EdgeMarkerDefs />
      {paths.map((line) => {
        return (
          <EdgeItem
            key={line.id}
            edge={line.edge}
            path={line.path}
            hitTestThresholdScreen={hitTestThresholdScreen}
            selected={line.id === stateSelectedEdgeId}
            onPathPointerDown={handlePathPointerDown}
            onPathClick={handlePathClick}
          />
        )
      })}
    </svg>
  )
}
