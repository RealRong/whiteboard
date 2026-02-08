import type { PointerEvent } from 'react'
import type { NodeHandleSide, NodeHandlesProps } from 'types/node'

const HANDLE_SIZE = 12
const HANDLE_SIZE_EXPR = `${HANDLE_SIZE}px`
const HANDLE_HALF_EXPR = `calc(${HANDLE_SIZE_EXPR} / var(--wb-zoom, 1) / 2)`

const baseStyle = {
  position: 'absolute' as const,
  width: `calc(${HANDLE_SIZE_EXPR} / var(--wb-zoom, 1))`,
  height: `calc(${HANDLE_SIZE_EXPR} / var(--wb-zoom, 1))`,
  borderRadius: 999,
  background: '#111827',
  border: 'calc(2px / var(--wb-zoom, 1)) solid #ffffff',
  boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
  cursor: 'crosshair',
  pointerEvents: 'auto' as const
}

const sideStyles: Record<NodeHandleSide, Record<string, string | number>> = {
  top: { left: '50%', top: `calc(-1 * ${HANDLE_HALF_EXPR})`, marginLeft: `calc(-1 * ${HANDLE_HALF_EXPR})` },
  right: { right: `calc(-1 * ${HANDLE_HALF_EXPR})`, top: '50%', marginTop: `calc(-1 * ${HANDLE_HALF_EXPR})` },
  bottom: { left: '50%', bottom: `calc(-1 * ${HANDLE_HALF_EXPR})`, marginLeft: `calc(-1 * ${HANDLE_HALF_EXPR})` },
  left: { left: `calc(-1 * ${HANDLE_HALF_EXPR})`, top: '50%', marginTop: `calc(-1 * ${HANDLE_HALF_EXPR})` }
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
