import type { Point } from '../types'
import { distancePointToSegment } from '../geometry'

export const getNearestEdgeSegment = (pointWorld: Point, pathPoints: Point[]) => {
  if (pathPoints.length < 2) return 0

  let minDistance = Number.POSITIVE_INFINITY
  let minIndex = Math.max(0, pathPoints.length - 2)

  for (let index = 0; index < pathPoints.length - 1; index += 1) {
    const distance = distancePointToSegment(pointWorld, pathPoints[index], pathPoints[index + 1])
    if (distance < minDistance) {
      minDistance = distance
      minIndex = index
    }
  }

  return minIndex
}
