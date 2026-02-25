import type { NodeId } from '@whiteboard/core/types'
import { MindmapLayer } from './MindmapLayer'
import { useViewSelector } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useMindmapTreeIds = () => {
  return useViewSelector<NodeId[]>((state) => state.mindmap.ids, {
    equality: isSameIdOrder
  })
}

export const MindmapLayerStack = () => {
  const treeIds = useMindmapTreeIds()
  const { drag, handleMindmapNodePointerDown } = useMindmapDragInteraction()
  return (
    <MindmapLayer
      treeIds={treeIds}
      drag={drag}
      onNodePointerDown={handleMindmapNodePointerDown}
    />
  )
}
