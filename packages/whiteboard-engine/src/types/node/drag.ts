import type { Node, NodeId, Point } from '@whiteboard/core/types'
import type { Size } from '../common/base'

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
  hoveredGroupId?: NodeId
}

export type NodeDragUpdateConstraints = {
  snapEnabled: boolean
  allowCross: boolean
}
