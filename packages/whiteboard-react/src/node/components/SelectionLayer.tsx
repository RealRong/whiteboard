import type { Rect } from '@whiteboard/core/types'
import { useWhiteboardSelector } from '../../common/hooks'

type SelectionLayerProps = {
  rect?: Rect
}

export const SelectionLayer = ({ rect }: SelectionLayerProps) => {
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
