import { rectFromPoints } from '../geometry'
import type {
  EdgeId,
  NodeId,
  Point,
  Rect
} from '../types'

export type SelectionMarqueeItems = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export const createMarqueeRect = (
  start: Point,
  current: Point
): Rect => rectFromPoints(start, current)

export const hasMarqueeStarted = (options: {
  startScreen: Point
  currentScreen: Point
  minDistance: number
  active: boolean
}) => {
  if (options.active) {
    return true
  }

  const dx = Math.abs(options.currentScreen.x - options.startScreen.x)
  const dy = Math.abs(options.currentScreen.y - options.startScreen.y)

  return dx >= options.minDistance || dy >= options.minDistance
}

export const createMarqueeItemsKey = (
  items: SelectionMarqueeItems
) => [
  [...items.nodeIds].sort().join('|'),
  [...items.edgeIds].sort().join('|')
].join('::')
