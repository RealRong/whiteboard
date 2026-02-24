import type { EdgeId, Point } from '@whiteboard/core/types'
import type { PointerInput } from '../common'

export type RoutingDragPayload = {
  edgeId: EdgeId
  index: number
  pointerId: number
  start: Point
  origin: Point
  point: Point
}

export type RoutingDragState = {
  payload?: RoutingDragPayload
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
