import {
  expandRectByThreshold as expandByThreshold,
  resolveInteractionZoom as resolveZoom,
  resolveWorldThreshold
} from '../snap'
import type { Rect } from '../types'

export type SnapThresholdConfig = {
  snapThresholdScreen: number
  snapMaxThresholdWorld: number
}

export const resolveInteractionZoom = (
  zoom: number,
  zoomEpsilon = 0.0001
) => resolveZoom(zoom, zoomEpsilon)

export const resolveSnapThresholdWorld = (
  node: SnapThresholdConfig,
  zoom: number,
  zoomEpsilon = 0.0001
) => resolveWorldThreshold(
  node.snapThresholdScreen,
  node.snapMaxThresholdWorld,
  zoom,
  zoomEpsilon
)

export const expandRectByThreshold = (
  rect: Rect,
  thresholdWorld: number
): Rect => expandByThreshold(rect, thresholdWorld)
