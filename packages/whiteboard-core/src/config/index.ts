import type { Size } from '../types'

export type InstanceConfig = {
  nodeSize: Size
  mindmapNodeSize: Size
  node: {
    groupPadding: number
    snapThresholdScreen: number
    snapMaxThresholdWorld: number
    snapGridCellSize: number
    selectionMinDragDistance: number
  }
  edge: {
    hitTestThresholdScreen: number
    anchorSnapMin: number
    anchorSnapRatio: number
  }
}

export const DEFAULT_NODE_SIZE: Size = {
  width: 120,
  height: 72
}

export const DEFAULT_MINDMAP_NODE_SIZE: Size = {
  width: 140,
  height: 36
}

export const DEFAULT_INSTANCE_CONFIG: InstanceConfig = {
  nodeSize: DEFAULT_NODE_SIZE,
  mindmapNodeSize: DEFAULT_MINDMAP_NODE_SIZE,
  node: {
    groupPadding: 24,
    snapThresholdScreen: 8,
    snapMaxThresholdWorld: 24,
    snapGridCellSize: 240,
    selectionMinDragDistance: 3
  },
  edge: {
    hitTestThresholdScreen: 10,
    anchorSnapMin: 12,
    anchorSnapRatio: 0.18
  }
}
