import type { EdgeId, Point } from '@whiteboard/core'

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
  pointerId: number
  clientX: number
  clientY: number
}

export type RoutingDragUpdateOptions = {
  pointerId: number
  clientX: number
  clientY: number
}

export type RoutingDragEndOptions = {
  pointerId: number
}

export type RoutingDragCancelOptions = {
  pointerId?: number
}
