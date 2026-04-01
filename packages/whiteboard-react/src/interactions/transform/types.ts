import type {
  Guide,
  ResizeDirection,
  TransformHandle,
  TransformPreviewPatch
} from '@whiteboard/core/node'
import type { Node, NodeId, Point, Rect } from '@whiteboard/core/types'
import type { ModifierKeys } from '@whiteboard/editor'
import type { InteractionCtx } from '../runtime'

export type TransformInteractionCtx = Pick<
  InteractionCtx,
  'read' | 'config' | 'commands' | 'overlay' | 'snap'
>

export type TransformPointerInput = {
  screen: Point
  world: Point
  modifiers: ModifierKeys
}

export type ResizeDragState = {
  mode: 'resize'
  pointerId: number
  handle: ResizeDirection
  startScreen: Point
  startCenter: Point
  startRotation: number
  startSize: {
    width: number
    height: number
  }
  startAspect: number
}

export type RotateDragState = {
  mode: 'rotate'
  pointerId: number
  startAngle: number
  startRotation: number
  center: Point
}

export type TransformDragState = ResizeDragState | RotateDragState

export type TransformTarget = {
  id: NodeId
  node: Node
  rect: Rect
}

export type TransformSession = {
  targets: readonly TransformTarget[]
  commitTargetIds?: ReadonlySet<NodeId>
  drag: TransformDragState
}

export type TransformProjection = {
  patches: readonly TransformPreviewPatch[]
  guides: readonly Guide[]
}

export type TransformPickHandle = Pick<TransformHandle, 'kind' | 'direction'>
