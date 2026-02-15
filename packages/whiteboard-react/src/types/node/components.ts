import type { NodeTransformHandle, NodeViewItem } from '@whiteboard/engine'
import type { PointerEvent } from 'react'

export type NodeItemProps = {
  item: NodeViewItem
  transformHandles?: NodeTransformHandle[]
}

export type NodeHandleSide = 'top' | 'right' | 'bottom' | 'left'

export type NodeHandlesProps = {
  onPointerDown?: (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => void
}
