import type { CSSProperties, PointerEvent, PointerEventHandler, ReactNode } from 'react'
import { forwardRef } from 'react'
import type { NodeId, Rect } from '@whiteboard/core/types'

type NodeBlockProps = {
  rect: Rect
  label?: ReactNode
  nodeId: NodeId
  selected?: boolean
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
}

export const NodeBlock = forwardRef<HTMLDivElement, NodeBlockProps>(({
  rect,
  label,
  nodeId,
  selected = false,
  className,
  style,
  onPointerDown
}: NodeBlockProps, ref) => {
  const borderColor = selected ? '#3b82f6' : '#1d1d1f'
  const boxShadow = selected ? '0 0 0 2px rgba(59, 130, 246, 0.4)' : '0 6px 16px rgba(0, 0, 0, 0.08)'
  return (
    <div
      ref={ref}
      className={className ? `wb-node-block ${className}` : 'wb-node-block'}
      data-node-id={nodeId}
      onPointerDown={onPointerDown}
      style={{
        width: rect.width,
        height: rect.height,
        border: `1px solid ${borderColor}`,
        boxShadow,
        ...style
      }}
    >
      {label}
    </div>
  )
})

NodeBlock.displayName = 'NodeBlock'
