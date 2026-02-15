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
