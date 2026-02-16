import type {
  MindmapLayoutOptions,
  MindmapNodeId,
  MindmapTree,
  NodeId,
  Point,
  Rect,
  Size as CoreSize
} from '@whiteboard/core'
import type { Size } from '../common'
import type {
  ResizeDirection,
  ResizeDragState,
  RotateDragState,
  TransformDragState
} from '../node'

export type {
  ResizeDirection,
  ResizeDragState,
  RotateDragState,
  TransformDragState
} from '../node'

export type NodeSizeObserver = {
  observe: (nodeId: NodeId, element: Element, enabled?: boolean) => void
  unobserve: (nodeId: NodeId) => void
  dispose: () => void
}

export type ContainerRect = {
  left: number
  top: number
  width: number
  height: number
}

export type ContainerSizeObserver = {
  observe: (element: Element, onRect: (rect: ContainerRect) => void) => void
  unobserve: (element?: Element) => void
  dispose: () => void
}

export type GroupAutoFit = {
  start: () => () => void
  stop: () => void
  sync: () => void
  reset: () => void
  dispose: () => void
}

export type ViewportNavigation = {
  startPan: (options: {
    pointerId: number
    button: number
    clientX: number
    clientY: number
    spacePressed: boolean
    enablePan: boolean
  }) => boolean
  updatePan: (options: {
    pointerId: number
    clientX: number
    clientY: number
  }) => void
  endPan: (options: {
    pointerId: number
  }) => boolean
  applyWheelZoom: (options: {
    clientX: number
    clientY: number
    deltaY: number
    enableWheel: boolean
    minZoom: number
    maxZoom: number
    wheelSensitivity: number
  }) => boolean
  dispose: () => void
}

export type EdgeHover = {
  onPointerMove: (options: {
    clientX: number
    clientY: number
    enabled: boolean
  }) => void
  cancel: () => void
  dispose: () => void
}

export type NodeTransform = {
  createResizeDrag: (options: {
    pointerId: number
    handle: ResizeDirection
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }) => ResizeDragState
  createRotateDrag: (options: {
    pointerId: number
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }) => RotateDragState
  applyResizeMove: (options: {
    nodeId: NodeId
    drag: ResizeDragState
    clientX: number
    clientY: number
    minSize: Size
    altKey: boolean
    shiftKey: boolean
  }) => void
  applyRotateMove: (options: {
    nodeId: NodeId
    drag: RotateDragState
    clientX: number
    clientY: number
    shiftKey: boolean
  }) => void
  finishResize: (options: {
    nodeId: NodeId
    drag: ResizeDragState
  }) => void
  clear: () => void
  dispose: () => void
}

export type MindmapSubtreeDropTarget = {
  type: 'attach' | 'reorder'
  parentId: MindmapNodeId
  index: number
  side?: 'left' | 'right'
  targetId?: MindmapNodeId
  connectionLine?: { x1: number; y1: number; x2: number; y2: number }
  insertLine?: { x1: number; y1: number; x2: number; y2: number }
}

export type MindmapDrag = {
  buildNodeRectMap: (options: {
    nodeRects: Partial<Record<MindmapNodeId, Rect>>
    shift: Point
    offset: Point
  }) => Map<MindmapNodeId, Rect>
  buildSubtreeGhostRect: (options: {
    pointerWorld: Point
    pointerOffset: Point
    nodeRect: Rect
  }) => Rect
  computeSubtreeDropTarget: (options: {
    tree: MindmapTree
    nodeRects: Map<MindmapNodeId, Rect>
    ghost: Rect
    dragNodeId: MindmapNodeId
    dragExcludeIds: Set<MindmapNodeId>
    layoutOptions?: MindmapLayoutOptions
  }) => MindmapSubtreeDropTarget | undefined
  dispose: () => void
}

export type PendingNodeSizeUpdate = {
  id: NodeId
  size: CoreSize
}
