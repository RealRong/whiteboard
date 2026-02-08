import type { Rect } from '@whiteboard/core'
import { useSelectionState } from '../hooks'

type SelectionLayerProps = {
  rect?: Rect
}

export const SelectionLayer = ({ rect }: SelectionLayerProps) => {
  const selectionState = useSelectionState()
  const resolvedRect = rect ?? (selectionState.tool === 'edge' ? undefined : selectionState.selectionRect)
  if (!resolvedRect) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: resolvedRect.x,
        top: resolvedRect.y,
        width: resolvedRect.width,
        height: resolvedRect.height,
        border: '1px solid rgba(59, 130, 246, 0.9)',
        background: 'rgba(59, 130, 246, 0.12)',
        borderRadius: 4,
        pointerEvents: 'none',
        zIndex: 10
      }}
    />
  )
}
