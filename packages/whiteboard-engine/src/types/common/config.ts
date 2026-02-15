import type { EdgeId, NodeId } from '@whiteboard/core'
import type { MindmapLayoutConfig } from '../mindmap'
import type { ShortcutOverrides } from '../shortcuts'
import type { Size, ViewportConfig, EdgeConfig, NodeConfig } from './base'

export type HistoryConfig = {
  enabled?: boolean
  capacity?: number
  captureSystem?: boolean
  captureRemote?: boolean
}

export type ResolvedHistoryConfig = {
  enabled: boolean
  capacity: number
  captureSystem: boolean
  captureRemote: boolean
}

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
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: EdgeId) => void
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
