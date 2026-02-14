import type {
  MindmapLayoutOptions,
  MindmapNodeId,
  MindmapTree,
  Node,
  NodeId,
  Point,
  Rect,
  Size as CoreSize
} from '@whiteboard/core'
import type { Size } from '../common'

export type NodeSizeObserverService = {
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

export type ContainerSizeObserverService = {
  observe: (element: Element, onRect: (rect: ContainerRect) => void) => void
  unobserve: (element?: Element) => void
  dispose: () => void
}

export type GroupAutoFitService = {
  start: (options: {
    getDocId?: () => string | undefined
    getNodes: () => Node[]
    getNodeSize: () => Size
    getPadding?: () => number
  }) => () => void
  stop: () => void
  sync: (options: {
    docId?: string
    nodes: Node[]
    nodeSize: Size
    padding?: number
  }) => void
  reset: () => void
  dispose: () => void
}

export type ViewportNavigationService = {
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

export type EdgeHoverService = {
  onPointerMove: (options: {
    clientX: number
    clientY: number
    enabled: boolean
  }) => void
  cancel: () => void
  dispose: () => void
}

export type TransformResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type NodeTransformResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: TransformResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: Size
  startAspect: number
  lastUpdate?: {
    position: Point
    size: Size
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

export type NodeTransformService = {
  createResizeDrag: (options: {
    pointerId: number
    handle: TransformResizeDirection
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }) => NodeTransformResizeDragState
  createRotateDrag: (options: {
    pointerId: number
    clientX: number
    clientY: number
    rect: Rect
    rotation: number
  }) => NodeTransformRotateDragState
  applyResizeMove: (options: {
    nodeId: NodeId
    drag: NodeTransformResizeDragState
    clientX: number
    clientY: number
    minSize: Size
    altKey: boolean
    shiftKey: boolean
  }) => void
  applyRotateMove: (options: {
    nodeId: NodeId
    drag: NodeTransformRotateDragState
    clientX: number
    clientY: number
    shiftKey: boolean
  }) => void
  finishResize: (options: {
    nodeId: NodeId
    drag: NodeTransformResizeDragState
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

export type MindmapDragService = {
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
