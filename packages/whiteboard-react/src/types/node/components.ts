import type { Node } from '@whiteboard/core'
import type { PointerEvent } from 'react'

export type NodeItemProps = {
  node: Node
}

export type NodeHandleSide = 'top' | 'right' | 'bottom' | 'left'

export type NodeHandlesProps = {
  onPointerDown?: (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => void
}
