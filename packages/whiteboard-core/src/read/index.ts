import type { MindmapLayout, MindmapLayoutConfig, MindmapNodeId, MindmapTree } from '../mindmap'
import type { Edge, EdgeAnchor, EdgeId, Node, NodeId, Point, Rect } from '../types'

export type CanvasNode = {
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

export type EdgeItem = {
  id: EdgeId
  edge: Edge
  endpoints: EdgeEndpoints
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
