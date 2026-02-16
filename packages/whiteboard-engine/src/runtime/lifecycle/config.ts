import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_CONFIG } from '../../config'
import type { Instance } from '@engine-types/instance'
import type { LifecycleConfig } from '@engine-types/instance'

export const createDefaultConfig = (instance: Instance): LifecycleConfig => ({
  docId: undefined,
  tool: 'select',
  viewport: {
    center: {
      x: DEFAULT_DOCUMENT_VIEWPORT.center.x,
      y: DEFAULT_DOCUMENT_VIEWPORT.center.y
    },
    zoom: DEFAULT_DOCUMENT_VIEWPORT.zoom
  },
  viewportConfig: {
    minZoom: DEFAULT_CONFIG.viewport.minZoom,
    maxZoom: DEFAULT_CONFIG.viewport.maxZoom,
    enablePan: DEFAULT_CONFIG.viewport.enablePan,
    enableWheel: DEFAULT_CONFIG.viewport.enableWheel,
    wheelSensitivity: instance.runtime.config.viewport.wheelSensitivity
  },
  mindmapLayout: {},
  history: undefined,
  shortcuts: undefined
})
