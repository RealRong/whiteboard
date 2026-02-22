import type { Rect } from '@whiteboard/core/types'
import { useWhiteboardSelector } from '../../common/hooks'

const isSameRect = (left?: Rect, right?: Rect) => {
  if (left === right) return true
  if (!left || !right) return false
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

export const SelectionLayer = () => {
  const rect = useWhiteboardSelector(
    (snapshot) => (snapshot.tool === 'edge' ? undefined : snapshot.selection.selectionRect),
    {
      keys: ['tool', 'selection'],
      equality: isSameRect
    }
  )

  if (!rect) return null

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
