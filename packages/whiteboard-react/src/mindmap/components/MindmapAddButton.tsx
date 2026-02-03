import type { CSSProperties } from 'react'

type MindmapAddButtonProps = {
  placement: 'up' | 'down' | 'left' | 'right'
  onClick: () => void
}

export const MindmapAddButton = ({ placement, onClick }: MindmapAddButtonProps) => {
  const base: CSSProperties = {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    background: '#ffffff',
    border: '1px solid #cbd5f5',
    color: '#1f2937',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    boxShadow: '0 1px 4px rgba(15, 23, 42, 0.15)',
    cursor: 'pointer'
  }
  const style =
    placement === 'up'
      ? { ...base, left: '50%', top: -10, transform: 'translate(-50%, -50%)' }
      : placement === 'down'
        ? { ...base, left: '50%', bottom: -10, transform: 'translate(-50%, 50%)' }
        : placement === 'left'
          ? { ...base, left: -10, top: '50%', transform: 'translate(-50%, -50%)' }
          : { ...base, right: -10, top: '50%', transform: 'translate(50%, -50%)' }
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
