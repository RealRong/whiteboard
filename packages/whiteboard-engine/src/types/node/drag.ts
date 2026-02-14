import type { Node, NodeId, NodePatch, Point, Rect } from '@whiteboard/core'
import type { Guide, SnapCandidate } from './snap'
import type { Size } from '../common'
import type { NodeViewUpdate } from '../state'

export type NodeDragSnapOptions = {
  enabled: boolean
  candidates: SnapCandidate[]
  getCandidates?: (rect: Rect) => SnapCandidate[]
  thresholdScreen: number
  onGuidesChange?: (guides: Guide[]) => void
}

export type NodeDragGroupOptions = {
  nodes: Node[]
  nodeSize: Size
  padding?: number
  setHoveredGroupId?: (groupId?: NodeId) => void
}

export type NodeDragTransientApi = {
  setOverrides: (updates: NodeViewUpdate[]) => void
  commitOverrides: (updates?: NodeViewUpdate[]) => void
}

export type NodeDragHandlers = {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
}

export type NodeDragChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

export type DragState = {
  pointerId: number
  start: Point
  origin: Point
  last?: Point
  children?: NodeDragChildren
}

export type DragStrategyBaseContext = {
  nodeId: NodeId
  nodeType: Node['type']
  position: Point
  size: { width: number; height: number }
  group?: NodeDragGroupOptions
  transient?: NodeDragTransientApi
  applyNodePatch: (nodeId: NodeId, patch: NodePatch) => void
  applyNodePositionUpdates: (updates: NodeViewUpdate[]) => void
  updateHoverGroup: (nextId?: NodeId) => void
  getHoverGroupId: () => NodeId | undefined
}

export type DragInitializeContext = DragStrategyBaseContext

export type DragMoveContext = DragStrategyBaseContext & {
  drag: DragState
  nextPosition: Point
}

export type DragEndContext = DragStrategyBaseContext & {
  drag: DragState
}

export type NodeDragStrategy = {
  key: 'plain' | 'group'
  initialize: (context: DragInitializeContext) => NodeDragChildren | undefined
  handleMove: (context: DragMoveContext) => void
  handlePointerUp: (context: DragEndContext) => void
}
