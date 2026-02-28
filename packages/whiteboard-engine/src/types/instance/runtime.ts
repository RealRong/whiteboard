import type { createStore } from 'jotai/vanilla'
import type { DocumentId, Viewport } from '@whiteboard/core/types'
import type { ShortcutOverrides } from '../shortcuts'
import type { ResolvedHistoryConfig } from '../common'
import type { MindmapLayoutConfig } from '../mindmap'

export type RuntimeConfig = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
  shortcuts?: ShortcutOverrides
}

export type RuntimeApi = {
  store: ReturnType<typeof createStore>
  applyConfig: (config: RuntimeConfig) => void
  dispose: () => void
}
