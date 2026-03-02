import type { createStore } from 'jotai/vanilla'
import type { DocumentId, Viewport } from '@whiteboard/core/types'
import type { ShortcutOverrides } from '../shortcuts/manager'
import type { ResolvedHistoryConfig } from '../common/config'
import type { MindmapLayoutConfig } from '../mindmap/layout'

export type Config = {
  docId?: DocumentId
  tool: 'select' | 'edge'
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
  shortcuts?: ShortcutOverrides
}

export type Api = {
  store: ReturnType<typeof createStore>
  applyConfig: (config: Config) => void
  dispose: () => void
}
