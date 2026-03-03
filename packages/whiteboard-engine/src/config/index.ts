import type { DocumentId, Viewport } from '@whiteboard/core/types'
import type { ResolvedConfig, Config } from '@engine-types/common/config'
import type { Config as Runtime } from '@engine-types/instance/runtime'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapLayoutConfig } from '@engine-types/mindmap/layout'
import type { ShortcutOverrides } from '@engine-types/shortcuts/manager'
import { mergeValue } from '@whiteboard/core/utils'
import {
  DEFAULT_CONFIG,
  DEFAULT_DOCUMENT_VIEWPORT,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS
} from './defaults'

export {
  DEFAULT_CONFIG,
  DEFAULT_DOCUMENT_VIEWPORT,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS,
  DEFAULT_TUNING
} from './defaults'

export const mergeConfig = (
  defaults: ResolvedConfig,
  overrides?: Config
): ResolvedConfig => mergeValue(defaults, overrides)

export const normalizeConfig = (config?: Config): ResolvedConfig => {
  const merged = mergeConfig(DEFAULT_CONFIG, config)
  const minZoom = Math.max(DEFAULT_INTERNALS.zoomEpsilon, merged.viewport.minZoom)
  const maxZoom = Math.max(minZoom, merged.viewport.maxZoom)

  return {
    ...merged,
    tool: merged.tool === 'edge' ? 'edge' : 'select',
    viewport: {
      ...merged.viewport,
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

export const resolveInstanceConfig = (
  configOverrides?: Partial<InstanceConfig>
): InstanceConfig => {
  const merged = mergeValue(DEFAULT_INSTANCE_CONFIG, configOverrides)

  return {
    ...merged,
    viewport: {
      ...merged.viewport,
      wheelSensitivity: Math.max(0, merged.viewport.wheelSensitivity)
    },
    features: {
      commandGatewayEnabled: merged.features.commandGatewayEnabled !== false,
      readInvalidationEnabled: merged.features.readInvalidationEnabled !== false,
      unifiedInversionEnabled: merged.features.unifiedInversionEnabled !== false,
      legacyMutateEnabled: Boolean(merged.features.legacyMutateEnabled)
    }
  }
}

export const toInstanceConfig = (
  config: ResolvedConfig
): InstanceConfig => ({
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
  },
  viewport: {
    wheelSensitivity: config.viewport.wheelSensitivity
  },
  features: {
    commandGatewayEnabled: DEFAULT_INSTANCE_CONFIG.features.commandGatewayEnabled,
    readInvalidationEnabled: DEFAULT_INSTANCE_CONFIG.features.readInvalidationEnabled,
    unifiedInversionEnabled: DEFAULT_INSTANCE_CONFIG.features.unifiedInversionEnabled,
    legacyMutateEnabled: DEFAULT_INSTANCE_CONFIG.features.legacyMutateEnabled
  }
})

type RuntimeOptions = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport?: Viewport
  mindmapLayout?: MindmapLayoutConfig
  history?: Runtime['history']
  shortcuts?: ShortcutOverrides
}

export const toRuntimeConfig = ({
  docId,
  tool,
  viewport,
  mindmapLayout,
  history,
  shortcuts
}: RuntimeOptions): Runtime => ({
  docId,
  tool,
  viewport: {
    center: {
      x: viewport?.center?.x ?? DEFAULT_DOCUMENT_VIEWPORT.center.x,
      y: viewport?.center?.y ?? DEFAULT_DOCUMENT_VIEWPORT.center.y
    },
    zoom: viewport?.zoom ?? DEFAULT_DOCUMENT_VIEWPORT.zoom
  },
  mindmapLayout: mindmapLayout ?? {},
  history: history ?? DEFAULT_CONFIG.history,
  shortcuts
})
