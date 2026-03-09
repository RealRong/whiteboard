import type { Size } from '@engine-types/common'
import type { InstanceConfig } from '@engine-types/instance'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { MindmapLayoutMode } from '@engine-types/mindmap'

export const DEFAULT_NODE_SIZE: Size = {
  width: 120,
  height: 72
}

export const DEFAULT_MINDMAP_NODE_SIZE: Size = {
  width: 140,
  height: 36
}

export const DEFAULT_MINDMAP_LAYOUT = {}

export const DEFAULT_HISTORY_CONFIG: ResolvedHistoryConfig = {
  enabled: true,
  capacity: 100,
  captureSystem: true,
  captureRemote: false
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

export const DEFAULT_TUNING = {
  nodeTransform: {
    minSize: {
      width: 20,
      height: 20
    } as Size,
    rotateHandleOffset: 24,
    rotateSnapStep: 15
  },
  nodeDrag: {
    snapCrossThresholdRatio: 0.6
  },
  group: {
    rectEpsilon: 0.5
  },
  edge: {
    anchorOffset: 0.5
  },
  mindmap: {
    defaultMode: 'simple' as MindmapLayoutMode,
    defaultSide: 'right' as const,
    dropSnapThreshold: 24,
    rootMoveThreshold: 0.5,
    reorderLineGap: 6,
    reorderLineOverflow: 12
  },
  shortcuts: {
    duplicateOffset: {
      x: 24,
      y: 24
    }
  },
  query: {
    snapGridPaddingFactor: 6
  }
} as const

export const DEFAULT_INTERNALS = {
  zoomEpsilon: 0.0001,
  containerRect: {
    left: 0,
    top: 0,
    width: 0,
    height: 0
  }
} as const
