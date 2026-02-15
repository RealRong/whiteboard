import type { WhiteboardNodeTransformHandle, WhiteboardNodeViewItem } from '@whiteboard/engine'
import type { PointerEvent } from 'react'

export type NodeItemProps = {
  item: WhiteboardNodeViewItem
  transformHandles?: WhiteboardNodeTransformHandle[]
}

export type NodeHandleSide = 'top' | 'right' | 'bottom' | 'left'

export type NodeHandlesProps = {
  onPointerDown?: (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => void
}
