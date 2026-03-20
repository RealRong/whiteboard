import type { MindmapLayout, MindmapLayoutConfig, MindmapNodeId, MindmapTree } from '../mindmap'
import type { Edge, EdgeAnchor, EdgeEnd, EdgeId, Node, NodeId, Point, Rect } from '../types'

export type CanvasNode = {
  node: Node
  rect: { x: number; y: number; width: number; height: number }
  aabb: { x: number; y: number; width: number; height: number }
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
  node: Node
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
