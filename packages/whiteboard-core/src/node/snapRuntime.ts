import type { Rect } from '../types'

export type SnapThresholdConfig = {
  snapThresholdScreen: number
  snapMaxThresholdWorld: number
}

export const resolveInteractionZoom = (
  zoom: number,
  zoomEpsilon = 0.0001
) => Math.max(zoom, zoomEpsilon)

export const resolveSnapThresholdWorld = (
  node: SnapThresholdConfig,
  zoom: number,
  zoomEpsilon = 0.0001
) =>
  Math.min(
    node.snapThresholdScreen / resolveInteractionZoom(zoom, zoomEpsilon),
    node.snapMaxThresholdWorld
  )

export const expandRectByThreshold = (
  rect: Rect,
  thresholdWorld: number
): Rect => ({
  x: rect.x - thresholdWorld,
  y: rect.y - thresholdWorld,
  width: rect.width + thresholdWorld * 2,
  height: rect.height + thresholdWorld * 2
})
