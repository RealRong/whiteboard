import type { CSSProperties } from 'react'
import type { Core, Document, EdgeId, NodeId } from '@whiteboard/core'
import type { ShortcutOverrides } from '@whiteboard/engine'
import type { NodeRegistry } from 'types/node'
import type { MindmapLayoutConfig } from '../mindmap'
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
  style?: CSSProperties
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

export type WhiteboardProps = {
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  core?: Core
  nodeRegistry?: NodeRegistry
  config?: Config
}
