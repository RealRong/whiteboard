import type {
  EdgeId,
  MindmapNodeId,
  Node,
  NodeId,
  Point,
  Rect,
  Size
} from '@whiteboard/core/types'
import type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'
import type { TransformDragState } from '../node'

export type { MindmapDragDropTarget } from '@whiteboard/core/mindmap'

export type SelectionMode = 'replace' | 'add' | 'subtract' | 'toggle'

export type SelectionState = {
  selectedNodeIds: Set<NodeId>
  selectedEdgeId?: EdgeId
  groupHovered?: NodeId
  mode: SelectionMode
}

export type SelectionBoxState = {
  isSelecting: boolean
  selectionRect?: Rect
  selectionRectWorld?: Rect
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

export type InteractionSessionKind =
  | 'nodeDrag'
  | 'nodeTransform'
  | 'edgeConnect'
  | 'routingDrag'
  | 'mindmapDrag'

export type InteractionSessionState = {
  active?: {
    kind: InteractionSessionKind
    pointerId: number
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
  payload?: MindmapRootDragState | MindmapSubtreeDragState
}

export type NodePreviewUpdate = {
  id: NodeId
  position?: Point
  size?: Size
  rotation?: number
}

export type NodePreviewState = {
  updates: NodePreviewUpdate[]
}

export type NodeDragPayload = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
}

export type NodeDragState = {
  payload?: NodeDragPayload
}

export type NodeTransformPayload = {
  nodeId: NodeId
  drag: TransformDragState
}

export type NodeTransformState = {
  payload?: NodeTransformPayload
}
