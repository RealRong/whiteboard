import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { MindmapDragView } from '@whiteboard/engine'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMindmap, useMindmapIds } from '../../common/hooks'
import { useMindmapDragInteraction } from '../hooks/useMindmapDragInteraction'
import { MindmapTreeView } from './MindmapTreeView'

const MindmapTreeItem = ({
  treeId,
  drag,
  onNodePointerDown
}: {
  treeId: NodeId
  drag?: MindmapDragView
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}) => {
  const tree = useMindmap(treeId)
  if (!tree) return null

  return (
    <MindmapTreeView
      item={tree}
      drag={drag}
      onNodePointerDown={onNodePointerDown}
    />
  )
}

export const MindmapFeature = () => {
  const treeIds = useMindmapIds()
  const { drag, handleMindmapNodePointerDown } = useMindmapDragInteraction()

  if (!treeIds.length) return null

  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeItem
          key={treeId}
          treeId={treeId}
          drag={drag}
          onNodePointerDown={handleMindmapNodePointerDown}
        />
      ))}
    </>
  )
}
