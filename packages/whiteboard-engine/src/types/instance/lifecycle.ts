import type { DocumentId, NodeId, Viewport } from '@whiteboard/core'
import type { ShortcutOverrides } from '../shortcuts'
import type { WhiteboardResolvedHistoryConfig } from '../common'
import type { MindmapLayoutConfig } from '../mindmap'

export type WhiteboardLifecycleViewportConfig = {
  minZoom: number
  maxZoom: number
  enablePan: boolean
  enableWheel: boolean
  wheelSensitivity: number
}

export type WhiteboardLifecycleConfig = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport: Viewport
  viewportConfig: WhiteboardLifecycleViewportConfig
  mindmapLayout: MindmapLayoutConfig
  history?: WhiteboardResolvedHistoryConfig
  shortcuts?: ShortcutOverrides
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: string) => void
}

export type WhiteboardLifecycleRuntime = {
  start: () => void
  update: (config: WhiteboardLifecycleConfig) => void
  stop: () => void
}
