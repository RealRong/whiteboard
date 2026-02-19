import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_CONFIG } from '../../config'
import type { LifecycleConfig } from '@engine-types/instance/lifecycle'
import type { RuntimeInternal } from '@engine-types/instance/runtime'

export const createDefaultConfig = (runtime: RuntimeInternal): LifecycleConfig => ({
  docId: undefined,
  tool: DEFAULT_CONFIG.tool,
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
    wheelSensitivity: runtime.config.viewport.wheelSensitivity
  },
  mindmapLayout: { ...DEFAULT_CONFIG.mindmapLayout },
  history: undefined,
  shortcuts: undefined
})
