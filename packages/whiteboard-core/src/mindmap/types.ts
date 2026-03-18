import type { Result } from '../types/result'

export type MindmapId = string
export type MindmapNodeId = string

export type MindmapNodeData =
  | { kind: 'text'; text?: string }
  | { kind: 'file'; fileId: string; name?: string }
  | { kind: 'link'; url: string; title?: string }
  | { kind: 'ref'; ref: { type: 'whiteboard-node' | 'object'; id: string }; title?: string }
  | { kind: 'custom'; [key: string]: unknown }

export interface MindmapNode {
  id: MindmapNodeId
  parentId?: MindmapNodeId
  side?: 'left' | 'right'
  collapsed?: boolean
  data?: MindmapNodeData | Record<string, unknown>
  style?: Record<string, string | number>
}

export interface MindmapTree {
  id: MindmapId
  rootId: MindmapNodeId
  nodes: Record<MindmapNodeId, MindmapNode>
  children: Record<MindmapNodeId, MindmapNodeId[]>
  meta?: {
    createdAt?: string
    updatedAt?: string
    position?: { x: number; y: number }
  }
}

export interface MindmapLayout {
  node: Record<MindmapNodeId, { x: number; y: number; width: number; height: number }>
  bbox: { x: number; y: number; width: number; height: number }
}

export interface MindmapLayoutOptions {
  hGap?: number
  vGap?: number
  side?: 'left' | 'right' | 'both'
}

export type MindmapLayoutMode = 'simple' | 'tidy'

export type MindmapLayoutConfig = {
  mode?: MindmapLayoutMode
  options?: MindmapLayoutOptions
}

export type GetNodeSize = (id: MindmapNodeId) => { width: number; height: number }

export interface MindmapSizeAdapter {
  getNodeSize: GetNodeSize
  invalidate?: (id?: MindmapNodeId) => void
}

export type LayoutMindmap = (tree: MindmapTree, getNodeSize: GetNodeSize, options?: MindmapLayoutOptions) => MindmapLayout

export interface MindmapIdGenerator {
  treeId?: () => MindmapId
  nodeId?: () => MindmapNodeId
}

export type MindmapDragDropLine = {
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapDragDropTarget = {
  type: 'attach' | 'reorder'
  parentId: MindmapNodeId
  index: number
  side?: 'left' | 'right'
  targetId?: MindmapNodeId
  connectionLine?: MindmapDragDropLine
  insertLine?: MindmapDragDropLine
}

export type MindmapCommandResult<T extends object = {}> = Result<{
  tree: MindmapTree
} & T, 'invalid'>

export type MindmapAttachPayload = {
  kind: 'file' | 'text' | 'link' | 'ref' | 'custom'
  fileId?: string
  text?: string
  url?: string
  title?: string
  ref?: { type: 'whiteboard-node' | 'object'; id: string }
  [key: string]: unknown
}
