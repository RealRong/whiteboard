import type {
  MindmapLayout,
  MindmapLayoutConfig,
  MindmapNodeId,
  MindmapTree
} from '@whiteboard/core/mindmap'
import type {
  Edge,
  EdgeAnchor,
  EdgeEnd,
  EdgeId,
  Node,
  NodeId,
  Point,
  Rect,
  SpatialNode
} from '@whiteboard/core/types'

export type CanvasNode = {
  node: Node
  rect: Rect
  aabb: Rect
  rotation: number
}

export type ResolvedEdgeEnd = {
  end: EdgeEnd
  point: Point
  anchor?: EdgeAnchor
}

export type EdgeEnds = {
  source: ResolvedEdgeEnd
  target: ResolvedEdgeEnd
}

export type EdgeItem = {
  id: EdgeId
  edge: Edge
  ends: EdgeEnds
}

export type MindmapLine = {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}

export type MindmapItem = {
  id: NodeId
  node: SpatialNode
  tree: MindmapTree
  layout: MindmapLayoutConfig
  computed: MindmapLayout
  shiftX: number
  shiftY: number
  lines: MindmapLine[]
  labels: Record<MindmapNodeId, string>
}

export type NodeItem = {
  node: Node
  rect: Rect
}
