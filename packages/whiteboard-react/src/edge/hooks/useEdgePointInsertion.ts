import { useCallback } from 'react'
import type { Edge, Point } from '@whiteboard/core'
import { useInstance } from '../../common/hooks'

export const useEdgePointInsertion = () => {
  const instance = useInstance()

  return useCallback(
    (edge: Edge, pathPoints: Point[], segmentIndex: number, pointWorld: Point) => {
      instance.commands.edge.insertRoutingPoint(edge, pathPoints, segmentIndex, pointWorld)
    },
    [instance]
  )
}
