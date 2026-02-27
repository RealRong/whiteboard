import { useWhiteboardSelector } from '../../common/hooks'
import { useSelectionBoxSelector } from '../../common/interaction/selectionBoxState'

export const SelectionLayer = () => {
  const rect = useSelectionBoxSelector((snapshot) => snapshot.rect)
  const tool = useWhiteboardSelector('tool')

  if (!rect || tool === 'edge') return null

  return (
    <div
      className="wb-selection-layer"
      style={{
        transform: `translate(${rect.x}px, ${rect.y}px)`,
        width: rect.width,
        height: rect.height
      }}
    />
  )
}
