import type { DocumentId, Viewport } from '@whiteboard/core'
import type { ResolvedConfig, Config } from '@engine-types/common'
import type {
  LifecycleConfig,
  LifecycleViewportConfig
} from '@engine-types/instance/lifecycle'
import type { Instance } from '@engine-types/instance/instance'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { ShortcutOverrides } from '@engine-types/shortcuts'
import {
  DEFAULT_CONFIG,
  DEFAULT_DOCUMENT_VIEWPORT,
  DEFAULT_INSTANCE_CONFIG,
  DEFAULT_INTERNALS
} from './defaults'

type UnknownRecord = Record<string, unknown>

const isPlainObject = (value: unknown): value is UnknownRecord => {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

const hasOwn = (value: UnknownRecord, key: string) => Object.prototype.hasOwnProperty.call(value, key)

const cloneConfigValue = <T,>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => cloneConfigValue(item)) as T
  }
  if (isPlainObject(value)) {
    const next: UnknownRecord = {}
    Object.keys(value).forEach((key) => {
      next[key] = cloneConfigValue(value[key])
    })
    return next as T
  }
  return value
}

const mergeConfigValue = <T,>(base: T, override?: unknown): T => {
  if (override === undefined || override === null) {
    return cloneConfigValue(base)
  }

  if (Array.isArray(base)) {
    if (!Array.isArray(override)) return cloneConfigValue(base)
    return cloneConfigValue(override as T)
  }

  if (isPlainObject(base)) {
    if (!isPlainObject(override)) return cloneConfigValue(base)

    const baseRecord = base as UnknownRecord
    const overrideRecord = override as UnknownRecord
    const merged: UnknownRecord = {}
    const keys = new Set([...Object.keys(baseRecord), ...Object.keys(overrideRecord)])

    keys.forEach((key) => {
      const baseValue = baseRecord[key]
      if (!hasOwn(overrideRecord, key)) {
        merged[key] = cloneConfigValue(baseValue)
        return
      }

      const overrideValue = overrideRecord[key]
      if (baseValue === undefined) {
        merged[key] = cloneConfigValue(overrideValue)
        return
      }

      merged[key] = mergeConfigValue(baseValue, overrideValue)
    })

    return merged as T
  }

  return cloneConfigValue(override as T)
}

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
): ResolvedConfig => mergeConfigValue(defaults, overrides)

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
  const merged = mergeConfigValue(DEFAULT_INSTANCE_CONFIG, configOverrides)

  return {
    ...merged,
    viewport: {
      ...merged.viewport,
      wheelSensitivity: Math.max(0, merged.viewport.wheelSensitivity)
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
  }
})

type LifecycleOptions = {
  instance: Instance
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport?: Viewport
  viewportConfig?: Partial<LifecycleViewportConfig>
  mindmapLayout?: MindmapLayoutConfig
  history?: LifecycleConfig['history']
  shortcuts?: ShortcutOverrides
}

export const toLifecycleConfig = ({
  instance,
  docId,
  tool,
  viewport,
  viewportConfig,
  mindmapLayout,
  history,
  shortcuts
}: LifecycleOptions): LifecycleConfig => ({
  docId,
  tool,
  viewport: {
    center: {
      x: viewport?.center?.x ?? DEFAULT_DOCUMENT_VIEWPORT.center.x,
      y: viewport?.center?.y ?? DEFAULT_DOCUMENT_VIEWPORT.center.y
    },
    zoom: viewport?.zoom ?? DEFAULT_DOCUMENT_VIEWPORT.zoom
  },
  viewportConfig: {
    minZoom: viewportConfig?.minZoom ?? DEFAULT_CONFIG.viewport.minZoom,
    maxZoom: viewportConfig?.maxZoom ?? DEFAULT_CONFIG.viewport.maxZoom,
    enablePan: viewportConfig?.enablePan ?? DEFAULT_CONFIG.viewport.enablePan,
    enableWheel: viewportConfig?.enableWheel ?? DEFAULT_CONFIG.viewport.enableWheel,
    wheelSensitivity: viewportConfig?.wheelSensitivity ?? instance.runtime.config.viewport.wheelSensitivity
  },
  mindmapLayout: mindmapLayout ?? {},
  history: history ?? DEFAULT_CONFIG.history,
  shortcuts
})
