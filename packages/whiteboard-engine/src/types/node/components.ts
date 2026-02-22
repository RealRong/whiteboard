import type { Node } from '@whiteboard/core/types'

export type NodeItemProps = {
  node: Node
}

export type NodeHandleSide = 'top' | 'right' | 'bottom' | 'left'

export type NodeHandlesProps = {
  onPointerDown?: (event: PointerEvent, side: NodeHandleSide) => void
}
