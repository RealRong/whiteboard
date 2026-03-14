import { useOverlayView } from './view'

export const SelectionBoxOverlay = () => {
  const overlay = useOverlayView()

  if (!overlay.selectionBox) return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${overlay.selectionBox.x}px, ${overlay.selectionBox.y}px)`,
        width: overlay.selectionBox.width,
        height: overlay.selectionBox.height
      }}
    />
  )
}
