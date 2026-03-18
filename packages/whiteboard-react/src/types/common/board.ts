import type { CSSProperties } from 'react'
import type { HistoryConfig as KernelHistoryConfig } from '@whiteboard/core/kernel'
import type { CoreRegistries, Document } from '@whiteboard/core/types'
import type { NodeRegistry } from '../node'
import type { MindmapLayoutConfig } from '../mindmap'
import type { Tool } from '../../runtime/tool'
import type { Size, ViewportConfig, EdgeConfig, NodeConfig } from './base'
import type { ShortcutOverrides } from './shortcut'

export type HistoryOptions = Partial<KernelHistoryConfig>

export type WhiteboardOptions = {
  className?: string
  style?: CSSProperties
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  node?: NodeConfig
  edge?: EdgeConfig
  history?: HistoryOptions
  tool?: Tool
  shortcuts?: ShortcutOverrides
}

export type WhiteboardProps = {
  document: Document
  onDocumentChange: (document: Document) => void
  coreRegistries?: CoreRegistries
  nodeRegistry?: NodeRegistry
  options?: WhiteboardOptions
}
