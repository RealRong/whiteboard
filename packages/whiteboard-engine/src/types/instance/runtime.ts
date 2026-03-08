import type { ResolvedHistoryConfig } from '../common/config'
import type { MindmapLayoutConfig } from '../mindmap/layout'

export type Config = {
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type Api = {
  configure: (config: Config) => void
  dispose: () => void
}
