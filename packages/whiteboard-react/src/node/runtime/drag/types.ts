import type { Core, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { PointerEvent } from 'react'
import type { Guide, SnapCandidate } from '../../utils/snap'
import type { Size } from '../../../common/types'
import type { NodeViewUpdate } from '../../state/nodeViewOverridesAtom'

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
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
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
  core: Core
  nodeId: NodeId
  nodeType: Node['type']
  position: Point
  size: { width: number; height: number }
  group?: NodeDragGroupOptions
  transient?: NodeDragTransientApi
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
