import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { MindmapLayoutConfig } from '../types/mindmap'
import type {
  Size,
  ViewportConfig,
  EdgeConfig,
  NodeConfig
} from '../types/common'
import type { BoardOptions } from '../types/common'

export type ResolvedHistoryConfig = KernelHistoryConfig
export type ResolvedViewportConfig = Required<ViewportConfig>
export type ResolvedNodeConfig = Required<NodeConfig>
export type ResolvedEdgeConfig = Required<EdgeConfig>

export type ResolvedConfig = Omit<
  BoardOptions,
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
