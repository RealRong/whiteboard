import type { CoreRegistries, Document, Edge, EdgeAnchor, EdgeId, MindmapNodeId, MindmapTree, Node, NodeId, Point, Rect, Viewport } from '@whiteboard/core/types'
import type { MindmapDragDropTarget, MindmapLayout } from '@whiteboard/core/mindmap'
import type { Commands } from './command'
import type { ResolvedHistoryConfig, Size } from './common'
import type { MindmapLayoutConfig } from './mindmap'
import type { SnapCandidate } from './node'

export type InstanceConfig = {
  nodeSize: Size
  mindmapNodeSize: Size
  node: {
    groupPadding: number
    snapThresholdScreen: number
    snapMaxThresholdWorld: number
    snapGridCellSize: number
    selectionMinDragDistance: number
  }
  edge: {
    hitTestThresholdScreen: number
    anchorSnapMin: number
    anchorSnapRatio: number
  }
  viewport: {
    wheelSensitivity: number
  }
}

export type CanvasNodeRect = {
  node: Node
  rect: { x: number; y: number; width: number; height: number }
  aabb: { x: number; y: number; width: number; height: number }
  rotation: number
}

export type EdgeEndpoint = {
  nodeId: NodeId
  anchor: EdgeAnchor
  point: Point
}

export type EdgeEndpoints = {
  source: EdgeEndpoint
  target: EdgeEndpoint
}

export type EdgeEntry = {
  id: EdgeId
  edge: Edge
  endpoints: EdgeEndpoints
}

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type MindmapViewTreeLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapDragPreview = {
  nodeId: MindmapNodeId
  ghost: Rect
  drop?: MindmapDragDropTarget
}

export type MindmapDragView = {
  treeId: NodeId
  kind: 'root' | 'subtree'
  baseOffset: Point
  preview?: MindmapDragPreview
}

export type MindmapViewTree = {
  id: NodeId
  node: Node
  tree: MindmapTree
  layout: MindmapLayoutConfig
  computed: MindmapLayout
  shiftX: number
  shiftY: number
  lines: MindmapViewTreeLine[]
  labels: Record<MindmapNodeId, string>
}

export type NodeViewItem = {
  node: Node
  rect: Rect
}

export type NodesView = {
  ids: readonly NodeId[]
  byId: ReadonlyMap<NodeId, Readonly<NodeViewItem>>
}

export type EdgesView = {
  ids: readonly EdgeId[]
  byId: ReadonlyMap<EdgeId, Readonly<EdgeEntry>>
}

export type MindmapView = {
  ids: readonly NodeId[]
  byId: ReadonlyMap<NodeId, Readonly<MindmapViewTree>>
}

export type EngineReadIndex = {
  node: {
    all: () => CanvasNodeRect[]
    byId: (nodeId: NodeId) => CanvasNodeRect | undefined
    idsInRect: (rect: Rect) => NodeId[]
  }
  snap: {
    all: () => SnapCandidate[]
    inRect: (rect: Rect) => SnapCandidate[]
  }
}

export const READ_KEYS = {
  viewport: 'viewport',
  node: 'node',
  edge: 'edge',
  mindmap: 'mindmap'
} as const

export type ReadSubscriptionKey =
  (typeof READ_KEYS)[keyof typeof READ_KEYS]

export type EngineRead = {
  viewport: Viewport
  node: NodesView
  edge: EdgesView
  mindmap: MindmapView
  index: EngineReadIndex
  document: Readonly<Document>
  subscribe: (key: ReadSubscriptionKey, listener: () => void) => () => void
}

export type RuntimeConfig = {
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type Instance = {
  config: Readonly<InstanceConfig>
  read: EngineRead
  commands: Commands
  configure: (config: RuntimeConfig) => void
  dispose: () => void
}

export type EngineDocument = {
  get: () => Document
  commit: (doc: Document) => void
}

export type DocumentSource = EngineDocument & {
  subscribeViewport: (listener: () => void) => () => void
}

export type CreateEngineOptions = {
  registries?: CoreRegistries
  /**
   * Engine treats document input as immutable data.
   * Replacing or loading with the same document reference is unsupported.
   */
  document: Document
  onDocumentChange?: (doc: Document) => void
  config?: Partial<InstanceConfig>
}
