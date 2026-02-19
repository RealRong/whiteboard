import type { EdgeId, Point } from '@whiteboard/core'
import type { PointerInput } from '../common'

export type RoutingDragActiveState = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
}

export type RoutingDragState = {
  active?: RoutingDragActiveState
}

export type RoutingDragStartOptions = {
  edgeId: EdgeId
  index: number
  pointer: PointerInput
}

export type RoutingDragUpdateOptions = {
  pointer: PointerInput
}

export type RoutingDragEndOptions = {
  pointer: PointerInput
}

export type RoutingDragCancelOptions = {
  pointer?: PointerInput
}
