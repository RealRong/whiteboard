import type { NodeId, Point, Rect } from '@whiteboard/core'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { SelectionMode } from '../state'

export type UseSelectionOptions = {
  minDragDistance?: number
  enabled?: boolean
}

export type SelectionHandlers = {
  onPointerDown: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
  onPointerMove: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
  onPointerUp: (event: ReactPointerEvent<HTMLElement> | PointerEvent) => void
}

export type UseSelectionStateReturn = {
  tool: string
  selectedEdgeId?: string
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  isSelected: (id: NodeId) => boolean
  hasSelection: () => boolean
}

export type UseSelectionRuntimeReturn = {
  beginBox: (pointScreen: Point, mode?: SelectionMode) => void
  updateBox: (pointScreen: Point) => void
  endBox: () => void
  getModeFromEvent: (event: PointerEvent | MouseEvent) => SelectionMode
  handlers?: SelectionHandlers
  cancelPendingRaf: () => void
}

export type UseSelectionReturn = UseSelectionStateReturn & {
  select: (ids: NodeId[], mode?: SelectionMode) => void
  toggle: (ids: NodeId[]) => void
  clear: () => void
} & UseSelectionRuntimeReturn
