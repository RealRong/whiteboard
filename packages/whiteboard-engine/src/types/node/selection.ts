import type { EdgeId, NodeId, Point, Rect } from '@whiteboard/core'
import type { SelectionMode } from '../state'

export type SelectionOptions = {
  minDragDistance?: number
  enabled?: boolean
}

export type SelectionHandlers = {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
}

export type SelectionState = {
  tool: 'select' | 'edge'
  selectedEdgeId?: EdgeId
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  isSelected: (id: NodeId) => boolean
  hasSelection: () => boolean
}

export type SelectionRuntime = {
  beginBox: (pointScreen: Point, mode?: SelectionMode) => void
  updateBox: (pointScreen: Point) => void
  endBox: () => void
  getModeFromEvent: (event: PointerEvent | MouseEvent) => SelectionMode
  handlers?: SelectionHandlers
  cancelPendingRaf: () => void
}

export type SelectionModel = SelectionState & {
  select: (ids: NodeId[], mode?: SelectionMode) => void
  toggle: (ids: NodeId[]) => void
  clear: () => void
} & SelectionRuntime
