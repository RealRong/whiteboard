import type { DocumentId, NodeId, Viewport } from '@whiteboard/core'
import type { ResolvedWhiteboardConfig, WhiteboardConfig } from '@engine-types/common'
import type {
  WhiteboardInstance,
  WhiteboardInstanceConfig,
  WhiteboardLifecycleConfig,
  WhiteboardLifecycleViewportConfig
} from '@engine-types/instance'
import type { ShortcutOverrides } from '@engine-types/shortcuts'
import { DEFAULT_MINDMAP_NODE_SIZE, DEFAULT_NODE_SIZE } from '../geometry/geometry'
import { DEFAULT_GROUP_PADDING } from '../node/constants'

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

export const DEFAULT_DOCUMENT_VIEWPORT: Viewport = {
  center: { x: 0, y: 0 },
  zoom: 1
}

export const DEFAULT_INSTANCE_CONFIG: WhiteboardInstanceConfig = {
  nodeSize: DEFAULT_NODE_SIZE,
  mindmapNodeSize: DEFAULT_MINDMAP_NODE_SIZE,
  node: {
    groupPadding: DEFAULT_GROUP_PADDING,
    snapThresholdScreen: 8,
    snapMaxThresholdWorld: 24,
    snapGridCellSize: 240,
    selectionMinDragDistance: 3
  },
  edge: {
    hitTestThresholdScreen: 10,
    anchorSnapMin: 12,
    anchorSnapRatio: 0.18
  },
  viewport: {
    wheelSensitivity: 0.001
  }
}

export const DEFAULT_WHITEBOARD_CONFIG: ResolvedWhiteboardConfig = {
  className: undefined,
  style: undefined,
  nodeSize: DEFAULT_INSTANCE_CONFIG.nodeSize,
  mindmapNodeSize: DEFAULT_INSTANCE_CONFIG.mindmapNodeSize,
  mindmapLayout: {},
  viewport: {
    minZoom: 0.1,
    maxZoom: 4,
    enablePan: true,
    enableWheel: true,
    wheelSensitivity: DEFAULT_INSTANCE_CONFIG.viewport.wheelSensitivity
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
  shortcuts: undefined,
  onSelectionChange: undefined,
  onEdgeSelectionChange: undefined
}

export const mergeWhiteboardConfig = (
  defaults: ResolvedWhiteboardConfig,
  overrides?: WhiteboardConfig
): ResolvedWhiteboardConfig => mergeConfigValue(defaults, overrides)

export const normalizeWhiteboardConfig = (config?: WhiteboardConfig): ResolvedWhiteboardConfig => {
  const merged = mergeWhiteboardConfig(DEFAULT_WHITEBOARD_CONFIG, config)
  const minZoom = Math.max(0.0001, merged.viewport.minZoom)
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

export const resolveWhiteboardInstanceConfig = (
  configOverrides?: Partial<WhiteboardInstanceConfig>
): WhiteboardInstanceConfig => {
  const merged = mergeConfigValue(DEFAULT_INSTANCE_CONFIG, configOverrides)

  return {
    ...merged,
    viewport: {
      ...merged.viewport,
      wheelSensitivity: Math.max(0, merged.viewport.wheelSensitivity)
    }
  }
}

export const toWhiteboardInstanceConfig = (
  config: ResolvedWhiteboardConfig
): WhiteboardInstanceConfig => ({
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
  instance: WhiteboardInstance
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport?: Viewport
  viewportConfig?: Partial<WhiteboardLifecycleViewportConfig>
  history?: WhiteboardLifecycleConfig['history']
  shortcuts?: ShortcutOverrides
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export const toWhiteboardLifecycleConfig = ({
  instance,
  docId,
  tool,
  viewport,
  viewportConfig,
  history,
  shortcuts,
  onSelectionChange,
  onEdgeSelectionChange
}: LifecycleOptions): WhiteboardLifecycleConfig => ({
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
    minZoom: viewportConfig?.minZoom ?? DEFAULT_WHITEBOARD_CONFIG.viewport.minZoom,
    maxZoom: viewportConfig?.maxZoom ?? DEFAULT_WHITEBOARD_CONFIG.viewport.maxZoom,
    enablePan: viewportConfig?.enablePan ?? DEFAULT_WHITEBOARD_CONFIG.viewport.enablePan,
    enableWheel: viewportConfig?.enableWheel ?? DEFAULT_WHITEBOARD_CONFIG.viewport.enableWheel,
    wheelSensitivity: viewportConfig?.wheelSensitivity ?? instance.runtime.config.viewport.wheelSensitivity
  },
  history: history ?? DEFAULT_WHITEBOARD_CONFIG.history,
  shortcuts,
  onSelectionChange,
  onEdgeSelectionChange
})
