import type { DocumentId, NodeId, Viewport } from '@whiteboard/core'
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
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export type Lifecycle = {
  start: () => void
  update: (config: LifecycleConfig) => void
  stop: () => void
}
