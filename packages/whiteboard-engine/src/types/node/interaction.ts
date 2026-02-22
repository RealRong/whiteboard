import type { Node } from '@whiteboard/core/types'

export type NodeContainerHandlers = {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerEnter: (event: PointerEvent) => void
  onPointerLeave: (event: PointerEvent) => void
}

export type NodeInteractionOptions = {
  node: Node
}
