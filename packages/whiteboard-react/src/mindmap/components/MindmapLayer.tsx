import type { NodeId, MindmapNodeId } from '@whiteboard/core/types'
import {
  READ_KEYS,
  type MindmapDragView,
  type MindmapViewTree
} from '@whiteboard/engine'
import { useInstance, useReadGetter } from '../../common/hooks'
import { MindmapTreeView } from './MindmapTreeView'
import type { PointerEvent as ReactPointerEvent } from 'react'

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
    () => instance.read.mindmap.byId.get(treeId),
    {
      key: READ_KEYS.mindmap
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
