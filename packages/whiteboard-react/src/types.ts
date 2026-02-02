import type { CSSProperties } from 'react'
import type { Core, Document, EdgeId, MindmapLayoutOptions, NodeId } from '@whiteboard/core'
import type { NodeRegistry } from './registry/nodeRegistry'

export type Size = { width: number; height: number }

export type MindmapLayoutMode = 'simple' | 'tidy'

export type MindmapLayoutConfig = {
  mode?: MindmapLayoutMode
  options?: MindmapLayoutOptions
}

export type ViewportConfig = {
  minZoom?: number
  maxZoom?: number
  enablePan?: boolean
  enableWheel?: boolean
}

export type WhiteboardProps = {
  doc: Document
  onDocChange: (recipe: (draft: Document) => void) => void
  core?: Core
  nodeRegistry?: NodeRegistry
  onSelectionChange?: (ids: NodeId[]) => void
  onEdgeSelectionChange?: (id?: EdgeId) => void
  className?: string
  style?: CSSProperties
  nodeSize?: Size
  mindmapNodeSize?: Size
  mindmapLayout?: MindmapLayoutConfig
  viewport?: ViewportConfig
  tool?: 'select' | 'edge'
}
