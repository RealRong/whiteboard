import type { Node, NodeId, Point } from '@whiteboard/core/types'
import type { Size } from './common'

export type NodeDragChildren = {
  ids: NodeId[]
  offsets: Map<NodeId, Point>
}

export type NodeDragDraft = {
  pointerId: number
  nodeId: NodeId
  nodeType: Node['type']
  start: Point
  origin: Point
  last: Point
  size: Size
  children?: NodeDragChildren
  hoveredContainerId?: NodeId
}

export type NodeDragUpdateConstraints = {
  snapEnabled: boolean
  allowCross: boolean
}

export type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type ResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: ResizeDirection
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

export type RotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  currentRotation?: number
  center: Point
}

export type TransformDragState = ResizeDragState | RotateDragState

export type NodeTransformDraft = {
  nodeId: NodeId
  drag: TransformDragState
}

export type NodeTransformResizeConstraints = {
  keepAspect: boolean
  fromCenter: boolean
  snapEnabled: boolean
}

export type NodeTransformRotateConstraints = {
  snapToStep: boolean
}

export type NodeTransformUpdateConstraints = {
  resize: NodeTransformResizeConstraints
  rotate: NodeTransformRotateConstraints
}

export type HandleKind = 'resize' | 'rotate'

export type TransformHandle = {
  id: string
  kind: HandleKind
  direction?: ResizeDirection
  position: Point
  cursor: string
}

export type NodeTransformOptions = {
  node: Node
  enabled?: boolean
  selected?: boolean
  activeTool?: 'select' | 'edge'
  canRotate?: boolean
  minSize?: Size
  handleSize?: number
  rotateHandleOffset?: number
}

export type {
  GridIndex,
  Guide,
  SnapAxis,
  SnapCandidate,
  SnapEdge,
  SnapResult
} from '@whiteboard/core/node'
