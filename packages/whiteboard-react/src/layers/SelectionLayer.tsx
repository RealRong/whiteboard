import type { Rect } from '@whiteboard/core'

type SelectionLayerProps = {
  rect?: Rect
}

export const SelectionLayer = ({ rect }: SelectionLayerProps) => {
  if (!rect) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        border: '1px solid rgba(59, 130, 246, 0.9)',
        background: 'rgba(59, 130, 246, 0.12)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  )
}
