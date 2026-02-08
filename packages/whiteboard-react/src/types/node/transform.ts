import type { Node, Point } from '@whiteboard/core'
import type { Size } from '../common'

export type ResizeDirection = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

export type HandleKind = 'resize' | 'rotate'

export type TransformHandle = {
  id: string
  kind: HandleKind
  direction?: ResizeDirection
  position: Point
  cursor: string
}

export type UseNodeTransformOptions = {
  node: Node
  enabled?: boolean
  canRotate?: boolean
  minSize?: Size
  handleSize?: number
  rotateHandleOffset?: number
}
