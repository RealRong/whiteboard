import { DEFAULT_DOCUMENT_VIEWPORT, DEFAULT_WHITEBOARD_CONFIG } from '../../../config'
import type { WhiteboardInstance } from '@engine-types/instance'
import type { WhiteboardLifecycleConfig } from '@engine-types/instance'

export const createDefaultLifecycleConfig = (instance: WhiteboardInstance): WhiteboardLifecycleConfig => ({
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
    minZoom: DEFAULT_WHITEBOARD_CONFIG.viewport.minZoom,
    maxZoom: DEFAULT_WHITEBOARD_CONFIG.viewport.maxZoom,
    enablePan: DEFAULT_WHITEBOARD_CONFIG.viewport.enablePan,
    enableWheel: DEFAULT_WHITEBOARD_CONFIG.viewport.enableWheel,
    wheelSensitivity: instance.runtime.config.viewport.wheelSensitivity
  },
  mindmapLayout: {},
  history: undefined,
  shortcuts: undefined,
  onSelectionChange: undefined,
  onEdgeSelectionChange: undefined
})
