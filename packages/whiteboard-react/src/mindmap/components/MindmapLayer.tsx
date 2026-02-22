import type { NodeId } from '@whiteboard/core'
import type { MindmapDragView, MindmapViewTree } from '@whiteboard/engine'
import { useViewSelector } from '../../common/hooks'
import { MindmapTreeView } from './MindmapTreeView'

type MindmapLayerProps = {
  treeIds: NodeId[]
  drag?: MindmapDragView
}

const useMindmapTree = (treeId: NodeId) => {
  return useViewSelector<MindmapViewTree | undefined>(
    (state) => state.mindmap.byId.get(treeId)
  )
}

const MindmapTreeById = ({ treeId, drag }: { treeId: NodeId; drag?: MindmapDragView }) => {
  const tree = useMindmapTree(treeId)
  if (!tree) return null
  return <MindmapTreeView item={tree} drag={drag} />
}

export const MindmapLayer = ({ treeIds, drag }: MindmapLayerProps) => {
  if (!treeIds.length) return null
  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeById key={treeId} treeId={treeId} drag={drag} />
      ))}
    </>
  )
}
