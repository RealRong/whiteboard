import type { EdgeAnchor, EdgeId, MindmapNodeId, Node, NodeId, Point, Rect } from '@whiteboard/core'

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

export type EdgeConnectFrom = {
  nodeId: NodeId
  anchor: EdgeAnchor
}

export type EdgeConnectTo = {
  nodeId?: NodeId
  anchor?: EdgeAnchor
  pointWorld?: Point
}

export type EdgeReconnectInfo = {
  edgeId: EdgeId
  end: 'source' | 'target'
}

export type EdgeConnectState = {
  isConnecting: boolean
  from?: EdgeConnectFrom
  to?: EdgeConnectTo
  hover?: EdgeConnectTo
  reconnect?: EdgeReconnectInfo
  pointerId?: number | null
}

export type EdgeRoutingPointDragActiveState = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
}

export type EdgeRoutingPointDragState = {
  active?: EdgeRoutingPointDragActiveState
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

export type NodeTransformResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type NodeTransformResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: NodeTransformResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: {
    width: number
    height: number
  }
  startAspect: number
  lastUpdate?: {
    position: Point
    size: {
      width: number
      height: number
    }
  }
}

export type NodeTransformRotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  center: Point
}

export type NodeTransformDragState = NodeTransformResizeDragState | NodeTransformRotateDragState

export type NodeTransformState = {
  active?: {
    nodeId: NodeId
    drag: NodeTransformDragState
  }
}
