import type { CSSProperties, PointerEvent, PointerEventHandler, ReactNode } from 'react'
import type { Rect } from '@whiteboard/core'
import { NodeHandles, type NodeHandleSide } from './NodeHandles'

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

export const NodeBlock = ({
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
}: NodeBlockProps) => {
  const borderColor = selected ? '#3b82f6' : '#1d1d1f'
  const boxShadow = selected ? '0 0 0 2px rgba(59, 130, 246, 0.4)' : '0 6px 16px rgba(0, 0, 0, 0.08)'
  return (
    <div
      className={className}
      data-node-id={nodeId}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: rect.width,
        height: rect.height,
        borderRadius: 8,
        border: `1px solid ${borderColor}`,
        background: '#ffffff',
        boxShadow,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 12,
        color: '#1d1d1f',
        userSelect: 'none',
        touchAction: 'none',
        overflow: 'visible',
        ...style
      }}
    >
      {showHandles && onHandlePointerDown && <NodeHandles onPointerDown={onHandlePointerDown} />}
      {label}
    </div>
  )
}
