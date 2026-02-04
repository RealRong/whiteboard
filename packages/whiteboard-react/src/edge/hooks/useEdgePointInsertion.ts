import { useCallback } from 'react'
import type { Core, Edge, Point } from '@whiteboard/core'

export const useEdgePointInsertion = (core: Core) => {
  return useCallback(
    (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => {
      if (edge.type === 'bezier' || edge.type === 'curve') return
      const basePoints = edge.routing?.points?.length ? edge.routing.points : pathPoints.slice(1, -1)
      const insertIndex = Math.max(0, Math.min(segmentIndex, basePoints.length))
      const nextPoints = [...basePoints]
      nextPoints.splice(insertIndex, 0, pointWorld)
      core.dispatch({
        type: 'edge.update',
        id: edge.id,
        patch: {
          routing: {
            ...(edge.routing ?? {}),
            mode: 'manual',
            points: nextPoints
          }
        }
      })
    },
    [core]
  )
}
