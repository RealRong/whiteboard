import type { ResolvedNodeConfig } from '@engine-types/common'
import type { Rect } from '@whiteboard/core/types'
import { DEFAULT_INTERNALS } from '../../../config'

type SnapNodeConfig = Pick<
  ResolvedNodeConfig,
  'snapThresholdScreen' | 'snapMaxThresholdWorld'
>

export const resolveInteractionZoom = (zoom: number) =>
  Math.max(zoom, DEFAULT_INTERNALS.zoomEpsilon)

export const resolveSnapThresholdWorld = (
  node: SnapNodeConfig,
  zoom: number
) =>
  Math.min(
    node.snapThresholdScreen / resolveInteractionZoom(zoom),
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
