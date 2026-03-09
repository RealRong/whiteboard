import { mergeValue } from '@whiteboard/core/utils'
import {
  DEFAULT_INSTANCE_CONFIG,
  type InstanceConfig as EngineInstanceConfig
} from '@whiteboard/engine'
import { DEFAULT_VIEWPORT } from '../common/instance/runtime/viewport'
import type { Config, ResolvedConfig } from '../types/common'

const ZOOM_EPSILON = 0.0001

const DEFAULT_CONFIG: ResolvedConfig = {
  className: undefined,
  style: undefined,
  nodeSize: DEFAULT_INSTANCE_CONFIG.nodeSize,
  mindmapNodeSize: DEFAULT_INSTANCE_CONFIG.mindmapNodeSize,
  mindmapLayout: {},
  viewport: {
    initial: DEFAULT_VIEWPORT,
    minZoom: 0.1,
    maxZoom: 4,
    enablePan: true,
    enableWheel: true,
    wheelSensitivity: 0.001
  },
  node: DEFAULT_INSTANCE_CONFIG.node,
  edge: DEFAULT_INSTANCE_CONFIG.edge,
  history: {
    enabled: true,
    capacity: 100,
    captureSystem: true,
    captureRemote: false
  },
  tool: 'select',
  shortcuts: undefined
}

export const mergeConfig = (
  defaults: ResolvedConfig,
  overrides?: Config
): ResolvedConfig => mergeValue(defaults, overrides)

export const normalizeConfig = (config?: Config): ResolvedConfig => {
  const merged = mergeConfig(DEFAULT_CONFIG, config)
  const minZoom = Math.max(ZOOM_EPSILON, merged.viewport.minZoom)
  const maxZoom = Math.max(minZoom, merged.viewport.maxZoom)

  return {
    ...merged,
    tool: merged.tool === 'edge' ? 'edge' : 'select',
    viewport: {
      ...merged.viewport,
      initial: merged.viewport.initial ?? DEFAULT_VIEWPORT,
      minZoom,
      maxZoom,
      wheelSensitivity: Math.max(0, merged.viewport.wheelSensitivity)
    },
    history: {
      ...merged.history,
      capacity: Math.max(0, merged.history.capacity)
    }
  }
}

export const toEngineInstanceConfig = (
  config: ResolvedConfig
): EngineInstanceConfig => ({
  nodeSize: {
    width: config.nodeSize.width,
    height: config.nodeSize.height
  },
  mindmapNodeSize: {
    width: config.mindmapNodeSize.width,
    height: config.mindmapNodeSize.height
  },
  node: {
    groupPadding: config.node.groupPadding,
    snapThresholdScreen: config.node.snapThresholdScreen,
    snapMaxThresholdWorld: config.node.snapMaxThresholdWorld,
    snapGridCellSize: config.node.snapGridCellSize,
    selectionMinDragDistance: config.node.selectionMinDragDistance
  },
  edge: {
    hitTestThresholdScreen: config.edge.hitTestThresholdScreen,
    anchorSnapMin: config.edge.anchorSnapMin,
    anchorSnapRatio: config.edge.anchorSnapRatio
  }
})

export { DEFAULT_CONFIG, DEFAULT_VIEWPORT }
