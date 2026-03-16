import { useInternalInstance } from '../../../runtime/hooks'
import { useSelectionDraft } from '../../../runtime/draft'

export const SelectionBoxOverlay = () => {
  const instance = useInternalInstance()
  const selectionBox = useSelectionDraft(instance.draft.selection)

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
