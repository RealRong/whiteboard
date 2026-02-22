import type { Point } from '@whiteboard/core/types'

export type PointerModifiers = {
  alt: boolean
  shift: boolean
  ctrl: boolean
  meta: boolean
}

export type PointerInput = {
  pointerId: number
  button: 0 | 1 | 2
  client: Point
  screen: Point
  world: Point
  modifiers: PointerModifiers
}
