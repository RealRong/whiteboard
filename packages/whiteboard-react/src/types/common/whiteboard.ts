import type { CSSProperties } from 'react'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { NodeRegistry } from 'types/node'
import type { MindmapLayoutConfig } from '../mindmap'
import type { Size, ViewportConfig, EdgeConfig, NodeConfig } from './base'
import type { ShortcutOverrides } from './shortcut'

export type HistoryConfig = Partial<KernelHistoryConfig>

export type ResolvedHistoryConfig = KernelHistoryConfig

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
  registries?: CoreRegistries
  nodeRegistry?: NodeRegistry
  config?: Config
}
