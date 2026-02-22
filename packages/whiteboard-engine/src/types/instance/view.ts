import type {
  Edge,
  EdgeAnchor,
  EdgeId,
  MindmapNodeId,
  MindmapTree,
  Node,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type { MindmapLayout } from '@whiteboard/core/mindmap'
import type { EdgePathEntry as EdgePathEntryType } from '../edge'
import type { MindmapLayoutConfig } from '../mindmap'
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

export type ReadonlyStore<TState> = {
  getState: () => TState
  subscribe: (listener: () => void) => () => void
}

export type ViewportView = {
  transform: ViewportTransformView
}

export type NodesView = {
  ids: NodeId[]
  byId: ReadonlyMap<NodeId, NodeViewItem>
  handlesById: ReadonlyMap<NodeId, readonly NodeTransformHandle[]>
}

export type EdgesView = {
  ids: EdgeId[]
  byId: ReadonlyMap<EdgeId, EdgePathEntry>
  preview: EdgePreviewView
  selection: {
    endpoints: EdgeEndpoints | undefined
    routing: EdgeSelectedRoutingView
  }
}

export type MindmapView = {
  ids: NodeId[]
  byId: ReadonlyMap<NodeId, MindmapViewTree>
  drag: MindmapDragView | undefined
}

export type ViewState = {
  viewport: ViewportView
  nodes: NodesView
  edges: EdgesView
  mindmap: MindmapView
}

export type View = ReadonlyStore<ViewState>
