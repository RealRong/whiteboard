import type { RefObject } from 'react'
import { useSelectionBox } from './useSelectionBox'

export const SelectionBoxOverlay = ({
  containerRef
}: {
  containerRef: RefObject<HTMLDivElement | null>
}) => {
  const selectionBox = useSelectionBox({
    containerRef
  })

  if (!selectionBox) return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${selectionBox.x}px, ${selectionBox.y}px)`,
        width: selectionBox.width,
        height: selectionBox.height
      }}
    />
  )
}
