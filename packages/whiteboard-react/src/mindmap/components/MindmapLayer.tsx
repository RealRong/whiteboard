import type { MindmapDragView, MindmapViewTree } from '@whiteboard/engine'
import { MindmapTreeView } from './MindmapTreeView'

type MindmapLayerProps = {
  trees: MindmapViewTree[]
  drag?: MindmapDragView
}

export const MindmapLayer = ({ trees, drag }: MindmapLayerProps) => {
  if (!trees.length) return null
  return (
    <>
      {trees.map((item) => (
        <MindmapTreeView key={item.id} item={item} drag={drag} />
      ))}
    </>
  )
}
