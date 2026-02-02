import type { CSSProperties, PointerEvent, PointerEventHandler, ReactNode } from 'react'
import type { Rect } from '@whiteboard/core'

type NodeBlockProps = {
  rect: Rect
  label?: ReactNode
  nodeId?: string
  selected?: boolean
  showHandles?: boolean
  onHandlePointerDown?: (event: PointerEvent<HTMLDivElement>, side: 'top' | 'right' | 'bottom' | 'left') => void
  className?: string
  style?: CSSProperties
  onPointerDown?: PointerEventHandler<HTMLDivElement>
  onPointerMove?: PointerEventHandler<HTMLDivElement>
  onPointerUp?: PointerEventHandler<HTMLDivElement>
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
  onPointerUp
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
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
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
      {showHandles && onHandlePointerDown && (
        <>
          <div
            data-selection-ignore
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              onHandlePointerDown(event, 'top')
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onPointerMove={(event) => event.preventDefault()}
            style={{
              position: 'absolute',
              left: '50%',
              top: -6,
              width: 12,
              height: 12,
              marginLeft: -6,
              borderRadius: 999,
              background: '#111827',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              cursor: 'crosshair',
              pointerEvents: 'auto'
            }}
          />
          <div
            data-selection-ignore
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              onHandlePointerDown(event, 'right')
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onPointerMove={(event) => event.preventDefault()}
            style={{
              position: 'absolute',
              right: -6,
              top: '50%',
              width: 12,
              height: 12,
              marginTop: -6,
              borderRadius: 999,
              background: '#111827',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              cursor: 'crosshair',
              pointerEvents: 'auto'
            }}
          />
          <div
            data-selection-ignore
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              onHandlePointerDown(event, 'bottom')
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onPointerMove={(event) => event.preventDefault()}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: -6,
              width: 12,
              height: 12,
              marginLeft: -6,
              borderRadius: 999,
              background: '#111827',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              cursor: 'crosshair',
              pointerEvents: 'auto'
            }}
          />
          <div
            data-selection-ignore
            onPointerDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
              event.currentTarget.setPointerCapture(event.pointerId)
              onHandlePointerDown(event, 'left')
            }}
            onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
            onPointerMove={(event) => event.preventDefault()}
            style={{
              position: 'absolute',
              left: -6,
              top: '50%',
              width: 12,
              height: 12,
              marginTop: -6,
              borderRadius: 999,
              background: '#111827',
              border: '2px solid #ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
              cursor: 'crosshair',
              pointerEvents: 'auto'
            }}
          />
        </>
      )}
      {label}
    </div>
  )
}
