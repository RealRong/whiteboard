import type { NodeId } from '@whiteboard/core/types'
import { MindmapLayer } from './MindmapLayer'
import { useInstance, useReadAtom } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'

export const MindmapLayerStack = () => {
  const instance = useInstance()
  const treeIds = useReadAtom<NodeId[]>(instance.read.atoms.mindmapIds)
  const { drag, handleMindmapNodePointerDown } = useMindmapDragInteraction()
  return (
    <MindmapLayer
      treeIds={treeIds}
      drag={drag}
      onNodePointerDown={handleMindmapNodePointerDown}
    />
  )
}
