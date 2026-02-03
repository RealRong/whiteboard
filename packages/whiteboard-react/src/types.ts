import type { CSSProperties } from 'react'
import type { Core, Document, EdgeId, NodeId } from '@whiteboard/core'
import type { NodeRegistry } from './node/registry/nodeRegistry'
import type { Size, ViewportConfig } from './common/types'
import type { MindmapLayoutConfig } from './mindmap/types'

export type { Size, ViewportConfig } from './common/types'
export type { MindmapLayoutMode, MindmapLayoutConfig } from './mindmap/types'

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
