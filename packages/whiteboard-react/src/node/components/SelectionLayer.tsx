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
      className="wb-selection-layer"
      style={{
        left: resolvedRect.x,
        top: resolvedRect.y,
        width: resolvedRect.width,
        height: resolvedRect.height
      }}
    />
  )
}
