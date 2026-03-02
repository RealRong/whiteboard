import type {
  EdgeAnchor,
  EdgeId,
  MindmapNodeId,
  MindmapTree,
  Node,
  NodeId,
  Point,
  Rect,
  Viewport
} from '@whiteboard/core/types'
import type { MindmapLayout } from '@whiteboard/core/mindmap'
import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { EdgePathEntry as EdgePathEntryType } from '../edge/geometry'
import type { MindmapLayoutConfig } from '../mindmap/layout'
import type { ReadModelSnapshot } from '../read/snapshot'
import type {
  InteractionState,
  SelectionState
} from '../state/model'

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

export type EdgePathEntry = EdgePathEntryType

export type EdgeConnectAnchorResult = {
  anchor: EdgeAnchor
  point: Point
}

export type ViewportTransformView = {
  center: Point
  zoom: number
  transform: string
  cssVars: {
    '--wb-zoom': string
  }
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
  container: {
    transformBase: string
    rotation: number
    transformOrigin: 'center center'
  }
}

export type ViewportView = {
  transform: ViewportTransformView
}

export type NodesView = {
  ids: NodeId[]
  byId: ReadonlyMap<NodeId, NodeViewItem>
}

export type EdgesView = {
  ids: EdgeId[]
  byId: ReadonlyMap<EdgeId, EdgePathEntry>
  selection: {
    endpoints: EdgeEndpoints | undefined
  }
}

export type MindmapView = {
  ids: NodeId[]
  byId: ReadonlyMap<NodeId, MindmapViewTree>
}

export type EngineReadGetters = {
  viewportTransform: () => ViewportTransformView
  nodeIds: () => NodeId[]
  nodeById: (id: NodeId) => NodeViewItem | undefined
  edgeIds: () => EdgeId[]
  edgeById: (id: EdgeId) => EdgePathEntry | undefined
  selectedEdgeId: () => EdgeId | undefined
  edgeSelectedEndpoints: () => EdgeEndpoints | undefined
  mindmapIds: () => NodeId[]
  mindmapById: (id: NodeId) => MindmapViewTree | undefined
}

export const READ_PUBLIC_KEYS = {
  interaction: 'interaction',
  tool: 'tool',
  selection: 'selection',
  viewport: 'viewport',
  mindmapLayout: 'mindmapLayout'
} as const

export const READ_SUBSCRIBE_KEYS = {
  ...READ_PUBLIC_KEYS,
  snapshot: 'snapshot'
} as const

export type ReadPublicKey =
  (typeof READ_PUBLIC_KEYS)[keyof typeof READ_PUBLIC_KEYS]

export type ReadPublicValueMap = {
  interaction: InteractionState
  tool: 'select' | 'edge'
  selection: SelectionState
  viewport: Viewport
  mindmapLayout: MindmapLayoutConfig
}

export type ReadSubscribeKey =
  (typeof READ_SUBSCRIBE_KEYS)[keyof typeof READ_SUBSCRIBE_KEYS]

export type ReadInternalKey = ReadSubscribeKey

export type ReadInternalValueMap = ReadPublicValueMap & {
  snapshot: ReadModelSnapshot
}

export type EngineReadGet = {
  <K extends ReadPublicKey>(key: K): ReadPublicValueMap[K]
} & EngineReadGetters

export type EngineRead = {
  get: EngineReadGet
  subscribe: (keys: readonly ReadSubscribeKey[], listener: () => void) => () => void
}
