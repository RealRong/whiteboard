import { createStore, type Atom } from 'jotai/vanilla'
import type {
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
  MindmapDragDropTarget
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

export type EngineReadAtoms = {
  viewportTransform: Atom<ViewportTransformView>
  nodeIds: Atom<NodeId[]>
  nodeById: (id: NodeId) => Atom<NodeViewItem | undefined>
  edgeIds: Atom<EdgeId[]>
  edgeById: (id: EdgeId) => Atom<EdgePathEntry | undefined>
  selectedEdgeId: Atom<EdgeId | undefined>
  edgeSelectedEndpoints: Atom<EdgeEndpoints | undefined>
  mindmapIds: Atom<NodeId[]>
  mindmapById: (id: NodeId) => Atom<MindmapViewTree | undefined>
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

export type EngineRead = {
  store: ReturnType<typeof createStore>
  atoms: EngineReadAtoms
  get: EngineReadGetters
}
