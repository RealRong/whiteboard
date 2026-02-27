import type { DocumentId, Viewport } from '@whiteboard/core/types'
import type { ShortcutOverrides } from '../shortcuts'
import type { ResolvedHistoryConfig } from '../common'
import type { MindmapLayoutConfig } from '../mindmap'

export type LifecycleConfig = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
  shortcuts?: ShortcutOverrides
}

export type Lifecycle = {
  update: (config: LifecycleConfig) => void
  dispose: () => void
}
