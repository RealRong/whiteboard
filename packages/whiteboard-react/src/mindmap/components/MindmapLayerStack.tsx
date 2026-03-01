import type { NodeId } from '@whiteboard/core/types'
import { MindmapLayer } from './MindmapLayer'
import { useInstance, useReadGetter } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'

export const MindmapLayerStack = () => {
  const instance = useInstance()
  const treeIds = useReadGetter<NodeId[]>(
    () => instance.read.get.mindmapIds(),
    { keys: ['snapshot', 'mindmapLayout'] }
  )
  const { drag, handleMindmapNodePointerDown } = useMindmapDragInteraction()
  return (
    <MindmapLayer
      treeIds={treeIds}
      drag={drag}
      onNodePointerDown={handleMindmapNodePointerDown}
    />
  )
}
