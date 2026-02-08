import type { CSSProperties } from 'react'
import type { Core, Document, EdgeId, NodeId } from '@whiteboard/core'
import type { NodeRegistry } from 'types/node'
import type { MindmapLayoutConfig } from '../mindmap'
import type { Shortcut } from '../shortcuts'
import type { Size, ViewportConfig } from './base'

export type WhiteboardConfig = {
  className?: string
  style?: CSSProperties
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  tool?: 'select' | 'edge'
  shortcuts?: Shortcut[] | ((defaults: Shortcut[]) => Shortcut[])
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: EdgeId) => void
}

export type WhiteboardProps = {
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  core?: Core
  nodeRegistry?: NodeRegistry
  config?: WhiteboardConfig
}
