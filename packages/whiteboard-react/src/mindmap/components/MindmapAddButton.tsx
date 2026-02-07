import type { CSSProperties } from 'react'

type MindmapAddButtonProps = {
  placement: 'up' | 'down' | 'left' | 'right'
  onClick: () => void
}

export const MindmapAddButton = ({ placement, onClick }: MindmapAddButtonProps) => {
  const BUTTON_SIZE = 18
  const BUTTON_OFFSET = 10
  const buttonSizeExpr = `calc(${BUTTON_SIZE}px / var(--wb-zoom, 1))`
  const buttonHalfExpr = `calc(${buttonSizeExpr} / 2)`
  const offsetExpr = `calc(${BUTTON_OFFSET}px / var(--wb-zoom, 1))`
  const base: CSSProperties = {
    position: 'absolute',
    width: buttonSizeExpr,
    height: buttonSizeExpr,
    borderRadius: buttonHalfExpr,
    background: '#ffffff',
    border: 'calc(1px / var(--wb-zoom, 1)) solid #cbd5f5',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `calc(12px / var(--wb-zoom, 1))`,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.15)',
    cursor: 'pointer'
  }
  const style =
    placement === 'up'
      ? { ...base, left: '50%', top: `calc(-1 * ${offsetExpr})`, transform: 'translate(-50%, -50%)' }
      : placement === 'down'
        ? { ...base, left: '50%', bottom: `calc(-1 * ${offsetExpr})`, transform: 'translate(-50%, 50%)' }
        : placement === 'left'
          ? { ...base, left: `calc(-1 * ${offsetExpr})`, top: '50%', transform: 'translate(-50%, -50%)' }
          : { ...base, right: `calc(-1 * ${offsetExpr})`, top: '50%', transform: 'translate(50%, -50%)' }
  return (
    <div
      style={style}
      onPointerDown={(event) => {
        event.preventDefault()
        event.stopPropagation()
      }}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClick()
      }}
    >
      +
    </div>
  )
}
