import type { Node } from '@whiteboard/core'

export type NodeContainerHandlers = {
  onPointerDown: (event: PointerEvent) => void
  onPointerMove: (event: PointerEvent) => void
  onPointerUp: (event: PointerEvent) => void
  onPointerEnter: (event: PointerEvent) => void
  onPointerLeave: (event: PointerEvent) => void
}

export type UseNodeInteractionOptions = {
  node: Node
}
