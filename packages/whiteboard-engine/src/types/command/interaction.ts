import type {
  MindmapId,
  MindmapNodeId,
  NodeId,
  Rect
} from '@whiteboard/core/types'
import type { Size } from '../common/base'
import type { PointerInput } from '../common/input'
import type { ResizeDirection } from '../node/transform'

export type MindmapStartDragOptions = {
  treeId: MindmapId
  nodeId: MindmapNodeId
  pointer: PointerInput
}

export type MindmapUpdateDragOptions = {
  pointer: PointerInput
}

export type MindmapEndDragOptions = {
  pointer: PointerInput
}

export type MindmapCancelDragOptions = {
  pointer?: PointerInput
}

export type NodeDragStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
}

export type NodeDragUpdateOptions = {
  pointer: PointerInput
}

export type NodeDragEndOptions = {
  pointer: PointerInput
}

export type NodeDragCancelOptions = {
  pointer?: PointerInput
}

export type NodeResizeStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
  handle: ResizeDirection
  rect: Rect
  rotation: number
}

export type NodeRotateStartOptions = {
  nodeId: NodeId
  pointer: PointerInput
  rect: Rect
  rotation: number
}

export type NodeTransformUpdateOptions = {
  pointer: PointerInput
  minSize?: Size
}

export type NodeTransformEndOptions = {
  pointer: PointerInput
}

export type NodeTransformCancelOptions = {
  pointer?: PointerInput
}
