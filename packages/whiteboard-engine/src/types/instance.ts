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
  nodeRects: () => CanvasNodeRect[]
  nodeRect: (nodeId: NodeId) => CanvasNodeRect | undefined
  nodeIdsInRect: (rect: Rect) => NodeId[]
  snapCandidates: () => SnapCandidate[]
  snapCandidatesInRect: (rect: Rect) => SnapCandidate[]
}

export const READ_STATE_KEYS = {
  viewport: 'viewport'
} as const

export const READ_SUBSCRIPTION_KEYS = {
  ...READ_STATE_KEYS,
  node: 'node',
  edge: 'edge',
  mindmap: 'mindmap'
} as const

export type ReadSubscriptionKey =
  (typeof READ_SUBSCRIPTION_KEYS)[keyof typeof READ_SUBSCRIPTION_KEYS]

export type EngineReadState = {
  viewport: Viewport
}

export type EngineReadProjection = {
  node: NodesView
  edge: EdgesView
  mindmap: MindmapView
}

export type EngineRead = {
  state: EngineReadState
  projection: EngineReadProjection
  index: EngineReadIndex
  config: InstanceConfig
  document: Readonly<Document>
  subscribe: (keys: readonly ReadSubscriptionKey[], listener: () => void) => () => void
}

export type RuntimeConfig = {
  mindmapLayout: MindmapLayoutConfig
  history?: ResolvedHistoryConfig
}

export type RuntimeApi = {
  configure: (config: RuntimeConfig) => void
  dispose: () => void
}

export type Instance = {
  runtime: RuntimeApi
  read: EngineRead
  commands: Commands
}

export type EngineContext = {
  document: {
    get: () => Document
    commit: (doc: Document) => void
  }
  config: InstanceConfig
  registries: CoreRegistries
  read: EngineRead
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
