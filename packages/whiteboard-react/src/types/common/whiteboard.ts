import type { CSSProperties } from 'react'
import type { Core, Document, EdgeId, NodeId } from '@whiteboard/core'
import type { NodeRegistry } from 'types/node'
import type { MindmapLayoutConfig } from '../mindmap'
import type { Shortcut } from '../shortcuts'
import type { HistoryState } from '../state'
import type { Size, ViewportConfig, WhiteboardEdgeConfig, WhiteboardNodeConfig } from './base'

export type WhiteboardHistoryConfig = {
  enabled?: boolean
  capacity?: number
  captureSystem?: boolean
  captureRemote?: boolean
}

export type WhiteboardConfig = {
  className?: string
  style?: CSSProperties
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  node?: WhiteboardNodeConfig
  edge?: WhiteboardEdgeConfig
  history?: WhiteboardHistoryConfig
  tool?: 'select' | 'edge'
  shortcuts?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: EdgeId) => void
  onHistoryChange?: (state: HistoryState) => void
}

export type WhiteboardProps = {
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  core?: Core
  nodeRegistry?: NodeRegistry
  config?: WhiteboardConfig
}
