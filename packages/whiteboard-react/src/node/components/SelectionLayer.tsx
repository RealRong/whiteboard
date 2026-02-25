import type { Rect } from '@whiteboard/core/types'
import {
  useWhiteboardRenderSelector,
  useWhiteboardSelector
} from '../../common/hooks'

const isSameRect = (left?: Rect, right?: Rect) => {
  if (left === right) return true
  if (!left || !right) return false
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

export const SelectionLayer = () => {
  const tool = useWhiteboardSelector('tool')
  const rect = useWhiteboardRenderSelector(
    (snapshot) => snapshot.selectionBox.selectionRect,
    {
      keys: ['selectionBox'],
      equality: isSameRect
    }
  )

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
