import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { Point } from '@whiteboard/core/types'

export type Size = { width: number; height: number }

export type ViewportConfig = {
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
  wheelSensitivity?: number
}

export type NodeConfig = {
  groupPadding?: number
  snapThresholdScreen?: number
  snapMaxThresholdWorld?: number
  snapGridCellSize?: number
  selectionMinDragDistance?: number
}

export type EdgeConfig = {
  hitTestThresholdScreen?: number
  anchorSnapMin?: number
  anchorSnapRatio?: number
}

export type HistoryConfig = Partial<KernelHistoryConfig>

export type ResolvedHistoryConfig = KernelHistoryConfig

export type PointerModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export type PointerInput = {
  pointerId: number
  button: 0 | 1 | 2
  client: Point
  screen: Point
  world: Point
  modifiers: PointerModifiers
}
