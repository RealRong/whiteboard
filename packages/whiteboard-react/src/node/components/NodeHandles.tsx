import type { PointerEvent } from 'react'

export type NodeHandleSide = 'top' | 'right' | 'bottom' | 'left'

type NodeHandlesProps = {
  onPointerDown?: (event: PointerEvent<HTMLDivElement>, side: NodeHandleSide) => void
}

const HANDLE_SIZE = 12
const HANDLE_OFFSET = HANDLE_SIZE / 2

const baseStyle = {
  position: 'absolute' as const,
  width: HANDLE_SIZE,
  height: HANDLE_SIZE,
  borderRadius: 999,
  background: '#111827',
  border: '2px solid #ffffff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  cursor: 'crosshair',
  pointerEvents: 'auto' as const
}

const sideStyles: Record<NodeHandleSide, Record<string, string | number>> = {
  top: { left: '50%', top: -HANDLE_OFFSET, marginLeft: -HANDLE_OFFSET },
  right: { right: -HANDLE_OFFSET, top: '50%', marginTop: -HANDLE_OFFSET },
  bottom: { left: '50%', bottom: -HANDLE_OFFSET, marginLeft: -HANDLE_OFFSET },
  left: { left: -HANDLE_OFFSET, top: '50%', marginTop: -HANDLE_OFFSET }
}

export const NodeHandles = ({ onPointerDown }: NodeHandlesProps) => {
  const sides: NodeHandleSide[] = ['top', 'right', 'bottom', 'left']
  return (
    <>
      {sides.map((side) => (
        <div
          key={side}
          data-selection-ignore
          onPointerDown={(event) => {
            if (!onPointerDown) return
            event.preventDefault()
            event.stopPropagation()
            event.currentTarget.setPointerCapture(event.pointerId)
            onPointerDown(event, side)
          }}
          onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
          onPointerMove={(event) => event.preventDefault()}
          style={{ ...baseStyle, ...sideStyles[side] }}
        />
      ))}
    </>
  )
}
