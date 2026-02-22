import type {
  EdgeId,
  MindmapNodeId,
  Node,
  NodeId,
  Point,
  Rect
} from '@whiteboard/core/types'
import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { TransformDragState } from '../node'

export type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'

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

export type NodeDragActiveState = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
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
