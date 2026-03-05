import type { createStore } from 'jotai/vanilla'
import type { Viewport } from '@whiteboard/core/types'
import type { ResolvedHistoryConfig } from '../common/config'
import type { MindmapLayoutConfig } from '../mindmap/layout'

export type Config = {
  tool: 'select' | 'edge'
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type Api = {
  store: ReturnType<typeof createStore>
  applyConfig: (config: Config) => void
  dispose: () => void
}
