import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { MindmapLayoutConfig } from '../mindmap/layout'
import type { ShortcutOverrides } from '../shortcuts/types'
import type { Size, ViewportConfig, EdgeConfig, NodeConfig } from './base'

export type HistoryConfig = Partial<KernelHistoryConfig>

export type ResolvedHistoryConfig = KernelHistoryConfig

export type ResolvedViewportConfig = Required<ViewportConfig>
export type ResolvedNodeConfig = Required<NodeConfig>
export type ResolvedEdgeConfig = Required<EdgeConfig>

export type Config = {
  className?: string
  style?: unknown
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  node?: NodeConfig
  edge?: EdgeConfig
  history?: HistoryConfig
  tool?: 'select' | 'edge'
  shortcuts?: ShortcutOverrides
}

export type ResolvedConfig = Omit<
  Config,
  'nodeSize' | 'mindmapNodeSize' | 'mindmapLayout' | 'viewport' | 'node' | 'edge' | 'history' | 'tool'
> & {
  nodeSize: Size
  mindmapNodeSize: Size
  mindmapLayout: MindmapLayoutConfig
  viewport: ResolvedViewportConfig
  node: ResolvedNodeConfig
  edge: ResolvedEdgeConfig
  history: ResolvedHistoryConfig
  tool: 'select' | 'edge'
}
