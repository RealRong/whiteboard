import { MindmapLayer } from './MindmapLayer'
import { useMindmapIds } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'

export const MindmapLayerStack = () => {
  const treeIds = useMindmapIds()
  const { drag, handleMindmapNodePointerDown } = useMindmapDragInteraction()
  return (
    <MindmapLayer
      treeIds={treeIds}
      drag={drag}
      onNodePointerDown={handleMindmapNodePointerDown}
    />
  )
}
