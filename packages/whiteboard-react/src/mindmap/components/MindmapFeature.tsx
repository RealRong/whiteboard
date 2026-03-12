import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useMindmapIds, useTransientReset } from '../../common/hooks'
import {
  useTransientMindmap,
  type Transient
} from '../../transient'
import { useMindmapDrag } from '../hooks/drag/useMindmapDrag'
import { useMindmapTreeView } from '../hooks/useMindmapTreeView'
import { MindmapTreeView } from './MindmapTreeView'

const MindmapTreeById = ({
  treeId,
  drag,
  onNodePointerDown
}: {
  treeId: NodeId
  drag: ReturnType<typeof useTransientMindmap>
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}) => {
  const view = useMindmapTreeView(
    treeId,
    drag?.treeId === treeId ? drag : undefined
  )
  if (!view) return null

  return (
    <MindmapTreeView
      view={view}
      onNodePointerDown={onNodePointerDown}
    />
  )
}

export const MindmapFeature = ({
  mindmap
}: {
  mindmap: Transient['mindmap']
}) => {
  const treeIds = useMindmapIds()
  const drag = useTransientMindmap(mindmap)
  const {
    cancelMindmapDragSession,
    handleMindmapNodePointerDown
  } = useMindmapDrag(mindmap)

  useTransientReset(cancelMindmapDragSession)

  if (!treeIds.length) return null

  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeById
          key={treeId}
          treeId={treeId}
          drag={drag}
          onNodePointerDown={handleMindmapNodePointerDown}
        />
      ))}
    </>
  )
}
