import {
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_MINDMAP_NODE_SIZE,
  DEFAULT_NODE_SIZE
} from '@whiteboard/core/config'
import type { Size } from '@engine-types/common'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { MindmapLayoutMode } from '@whiteboard/core/mindmap'
export {
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_MINDMAP_NODE_SIZE,
  DEFAULT_NODE_SIZE
} from '@whiteboard/core/config'

export const DEFAULT_MINDMAP_LAYOUT = {}

export const DEFAULT_HISTORY_CONFIG: ResolvedHistoryConfig = {
  enabled: true,
  capacity: 100,
  captureSystem: true,
  captureRemote: false
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
