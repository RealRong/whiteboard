import type { EdgeId, NodeId } from '@whiteboard/core'
import type { MindmapLayoutConfig } from '../mindmap'
import type { ShortcutOverrides } from '../shortcuts'
import type { Size, ViewportConfig, WhiteboardEdgeConfig, WhiteboardNodeConfig } from './base'

export type WhiteboardHistoryConfig = {
  enabled?: boolean
  capacity?: number
  captureSystem?: boolean
  captureRemote?: boolean
}

export type WhiteboardResolvedHistoryConfig = {
  enabled: boolean
  capacity: number
  captureSystem: boolean
  captureRemote: boolean
}

export type WhiteboardResolvedViewportConfig = Required<ViewportConfig>
export type WhiteboardResolvedNodeConfig = Required<WhiteboardNodeConfig>
export type WhiteboardResolvedEdgeConfig = Required<WhiteboardEdgeConfig>

export type WhiteboardConfig = {
  className?: string
  style?: unknown
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  node?: WhiteboardNodeConfig
  edge?: WhiteboardEdgeConfig
  history?: WhiteboardHistoryConfig
  tool?: 'select' | 'edge'
  shortcuts?: ShortcutOverrides
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: EdgeId) => void
}

export type ResolvedWhiteboardConfig = Omit<
  WhiteboardConfig,
  'nodeSize' | 'mindmapNodeSize' | 'mindmapLayout' | 'viewport' | 'node' | 'edge' | 'history' | 'tool'
> & {
  nodeSize: Size
  mindmapNodeSize: Size
  mindmapLayout: MindmapLayoutConfig
  viewport: WhiteboardResolvedViewportConfig
  node: WhiteboardResolvedNodeConfig
  edge: WhiteboardResolvedEdgeConfig
  history: WhiteboardResolvedHistoryConfig
  tool: 'select' | 'edge'
}
