import type {
  Edge,
  EdgeAnchor,
  EdgeId,
  MindmapLayout,
  MindmapNodeId,
  MindmapTree,
  Node,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core'
import type { EdgePathEntry as EdgePathEntryType } from '../edge'
import type { MindmapLayoutConfig } from '../mindmap'
import type { ShortcutContext } from '../shortcuts'
import type {
  EdgeReconnectInfo,
  MindmapDragDropTarget,
  ResizeDirection
} from '../state'

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

export type EdgePreviewView = {
  from?: Point
  to?: Point
  snap?: Point
  reconnect?: EdgeReconnectInfo
  showPreviewLine: boolean
}

export type EdgeSelectedRoutingView = {
  edge: Edge
  points: Point[]
} | undefined

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
  selected: boolean
  hovered: boolean
  activeTool: 'select' | 'edge'
  zoom: number
}

export type NodeTransformHandle = {
  id: string
  kind: 'resize' | 'rotate'
  direction?: ResizeDirection
  position: Point
  cursor: string
}

export type ViewSnapshot = {
  'viewport.transform': ViewportTransformView
  'shortcut.context': ShortcutContext
  'edge.entries': EdgePathEntry[]
  'edge.reconnect': EdgePathEntry | undefined
  'edge.paths': EdgePathEntry[]
  'edge.preview': EdgePreviewView
  'edge.selectedEndpoints': EdgeEndpoints | undefined
  'edge.selectedRouting': EdgeSelectedRoutingView
  'node.items': NodeViewItem[]
  'node.transformHandles': Map<NodeId, NodeTransformHandle[]>
  'mindmap.roots': Node[]
  'mindmap.trees': MindmapViewTree[]
  'mindmap.drag': MindmapDragView | undefined
}

export type ViewKey = keyof ViewSnapshot

export type ViewDebugMetric = {
  revision: number
  dirty: boolean
  recomputeCount: number
  cacheHitCount: number
  cacheMissCount: number
  cacheHitRate: number
  sampleCount: number
  sampleWindowSize: number
  p50ComputeMs: number
  p95ComputeMs: number
  lastComputeMs: number
  avgComputeMs: number
  maxComputeMs: number
  totalComputeMs: number
  lastComputedAt?: number
}

export type ViewDebugSnapshot = {
  [K in ViewKey]: ViewDebugMetric
}

export type ViewDebug = {
  getMetrics: <K extends ViewKey>(key: K) => ViewDebugMetric
  getAllMetrics: () => ViewDebugSnapshot
  resetMetrics: (key?: ViewKey) => void
}

export type ViewGlobal = {
  viewportTransform: () => ViewportTransformView
  watchViewportTransform: (listener: () => void) => () => void
  shortcutContext: () => ShortcutContext
  watchShortcutContext: (listener: () => void) => () => void
  edgePreview: () => EdgePreviewView
  watchEdgePreview: (listener: () => void) => () => void
  edgeSelectedEndpoints: () => EdgeEndpoints | undefined
  watchEdgeSelectedEndpoints: (listener: () => void) => () => void
  edgeSelectedRouting: () => EdgeSelectedRoutingView
  watchEdgeSelectedRouting: (listener: () => void) => () => void
  mindmapDrag: () => MindmapDragView | undefined
  watchMindmapDrag: (listener: () => void) => () => void
}

export type ViewNode = {
  ids: () => NodeId[]
  watchIds: (listener: () => void) => () => void
  item: (nodeId: NodeId) => NodeViewItem | undefined
  watchItem: (nodeId: NodeId, listener: () => void) => () => void
  handles: (nodeId: NodeId) => NodeTransformHandle[] | undefined
  watchHandles: (nodeId: NodeId, listener: () => void) => () => void
}

export type ViewEdge = {
  ids: () => EdgeId[]
  watchIds: (listener: () => void) => () => void
  path: (edgeId: EdgeId) => EdgePathEntry | undefined
  watchPath: (edgeId: EdgeId, listener: () => void) => () => void
}

export type ViewMindmap = {
  ids: () => NodeId[]
  watchIds: (listener: () => void) => () => void
  tree: (treeId: NodeId) => MindmapViewTree | undefined
  watchTree: (treeId: NodeId, listener: () => void) => () => void
}

export type View = {
  global: ViewGlobal
  node: ViewNode
  edge: ViewEdge
  mindmap: ViewMindmap
  debug: ViewDebug
}
