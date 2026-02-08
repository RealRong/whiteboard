import type { Node } from '@whiteboard/core'
import type { PointerEvent } from 'react'

export type NodeContainerHandlers = {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void
  onPointerEnter: (event: PointerEvent<HTMLDivElement>) => void
  onPointerLeave: (event: PointerEvent<HTMLDivElement>) => void
}

export type UseNodeInteractionOptions = {
  node: Node
}
