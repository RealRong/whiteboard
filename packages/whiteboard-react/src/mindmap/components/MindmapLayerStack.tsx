import type { NodeId } from '@whiteboard/core/types'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS
} from '@whiteboard/engine'
import { MindmapLayer } from './MindmapLayer'
import { useInstance, useReadGetter } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'

export const MindmapLayerStack = () => {
  const instance = useInstance()
  const treeIds = useReadGetter<NodeId[]>(
    () => [...instance.read.projection.mindmap.ids],
    {
      keys: [
        READ_SUBSCRIPTION_KEYS.mindmap,
        READ_STATE_KEYS.mindmapLayout
      ]
    }
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
