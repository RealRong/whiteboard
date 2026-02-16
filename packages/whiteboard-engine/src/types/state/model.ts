import type { EdgeId, MindmapNodeId, Node, NodeId, Point, Rect } from '@whiteboard/core'
import type { TransformDragState } from '../node'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionState = {
  selectedNodeIds: Set<NodeId>
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
  mode: SelectionMode
}

export type InteractionState = {
  focus: {
    isEditingText: boolean
    isInputFocused: boolean
    isImeComposing: boolean
  }
  pointer: {
    isDragging: boolean
    button?: 0 | 1 | 2
    modifiers: {
      alt: boolean
      shift: boolean
      ctrl: boolean
      meta: boolean
    }
  }
  hover: {
    nodeId?: NodeId
    edgeId?: EdgeId
  }
}

export type HistoryState = {
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  isApplying: boolean
  lastUpdatedAt?: number
}

export type MindmapDragDropTarget = {
  type: 'attach' | 'reorder'
  parentId: MindmapNodeId
  index: number
  side?: 'left' | 'right'
  targetId?: MindmapNodeId
  connectionLine?: { x1: number; y1: number; x2: number; y2: number }
  insertLine?: { x1: number; y1: number; x2: number; y2: number }
}

export type MindmapRootDragState = {
  kind: 'root'
  treeId: NodeId
  pointerId: number
  start: Point
  origin: Point
  position: Point
}

export type MindmapSubtreeDragState = {
  kind: 'subtree'
  treeId: NodeId
  pointerId: number
  nodeId: MindmapNodeId
  originParentId?: MindmapNodeId
  originIndex?: number
  baseOffset: Point
  offset: Point
  rect: Rect
  ghost: Rect
  excludeIds: MindmapNodeId[]
  drop?: MindmapDragDropTarget
}

export type MindmapDragState = {
  active?: MindmapRootDragState | MindmapSubtreeDragState
}

export type NodeDragChildrenState = {
  ids: NodeId[]
  offsets: Array<{
    id: NodeId
    offset: Point
  }>
}

export type NodeDragActiveState = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  size: {
    width: number
    height: number
  }
  last?: Point
  children?: NodeDragChildrenState
}

export type NodeDragState = {
  active?: NodeDragActiveState
}

export type NodeTransformState = {
  active?: {
    nodeId: NodeId
    drag: TransformDragState
  }
}
