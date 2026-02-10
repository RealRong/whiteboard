import type { CSSProperties, PointerEvent, PointerEventHandler, ReactNode } from 'react'
import { forwardRef } from 'react'
import type { Rect } from '@whiteboard/core'
import { NodeHandles } from './NodeHandles'
import type { NodeHandleSide } from 'types/node'

type NodeBlockProps = {
  rect: Rect
  label?: ReactNode
  nodeId?: string
  selected?: boolean
  showHandles?: boolean
  onHandlePointerDown?: (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => void
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
  onPointerEnter?: PointerEventHandler<HTMLDivElement>
  onPointerLeave?: PointerEventHandler<HTMLDivElement>
}

export const NodeBlock = forwardRef<HTMLDivElement, NodeBlockProps>(({
  rect,
  label,
  nodeId,
  selected = false,
  showHandles = false,
  onHandlePointerDown,
  className,
  style,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerEnter,
  onPointerLeave
}: NodeBlockProps, ref) => {
  const borderColor = selected ? '#3b82f6' : '#1d1d1f'
  const boxShadow = selected ? '0 0 0 2px rgba(59, 130, 246, 0.4)' : '0 6px 16px rgba(0, 0, 0, 0.08)'
  return (
    <div
      ref={ref}
      className={className ? `wb-node-block ${className}` : 'wb-node-block'}
      data-node-id={nodeId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        width: rect.width,
        height: rect.height,
        border: `1px solid ${borderColor}`,
        boxShadow,
        ...style
      }}
    >
      {showHandles && onHandlePointerDown && <NodeHandles onPointerDown={onHandlePointerDown} />}
      {label}
    </div>
  )
})

NodeBlock.displayName = 'NodeBlock'
