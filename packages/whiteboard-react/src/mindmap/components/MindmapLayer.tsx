import type { NodeId } from '@whiteboard/core/types'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type MindmapDragView,
  type MindmapViewTree
} from '@whiteboard/engine'
import { useInstance, useReadGetter } from '../../common/hooks'
import { MindmapTreeView } from './MindmapTreeView'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { MindmapNodeId } from '@whiteboard/core/types'

type MindmapLayerProps = {
  treeIds: NodeId[]
  drag?: MindmapDragView
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}

const useMindmapTree = (treeId: NodeId) => {
  const instance = useInstance()
  return useReadGetter<MindmapViewTree | undefined>(
    () => instance.read.projection.mindmap.byId.get(treeId),
    {
      keys: [
        READ_SUBSCRIPTION_KEYS.snapshot,
        READ_STATE_KEYS.mindmapLayout
      ]
    }
  )
}

const MindmapTreeById = ({
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
  const tree = useMindmapTree(treeId)
  if (!tree) return null
  return (
    <MindmapTreeView
      item={tree}
      drag={drag}
      onNodePointerDown={onNodePointerDown}
    />
  )
}

export const MindmapLayer = ({
  treeIds,
  drag,
  onNodePointerDown
}: MindmapLayerProps) => {
  if (!treeIds.length) return null
  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeById
          key={treeId}
          treeId={treeId}
          drag={drag}
          onNodePointerDown={onNodePointerDown}
        />
      ))}
    </>
  )
}
