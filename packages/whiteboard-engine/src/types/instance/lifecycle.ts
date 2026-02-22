import type { DocumentId, Viewport } from '@whiteboard/core/types'
import type { ShortcutOverrides } from '../shortcuts'
import type { ResolvedHistoryConfig } from '../common'
import type { MindmapLayoutConfig } from '../mindmap'

export type LifecycleViewportConfig = {
  minZoom: number
  maxZoom: number
  enablePan: boolean
  enableWheel: boolean
  wheelSensitivity: number
}

export type LifecycleConfig = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport: Viewport
  viewportConfig: LifecycleViewportConfig
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
  shortcuts?: ShortcutOverrides
}

export type Lifecycle = {
  start: () => void
  update: (config: LifecycleConfig) => void
  stop: () => void
}
