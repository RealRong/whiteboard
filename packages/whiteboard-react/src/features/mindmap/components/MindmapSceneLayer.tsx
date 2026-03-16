import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'
import { useMindmapDraft } from '../../../runtime/draft'
import { useMindmapTreeView } from '../hooks/useMindmapTreeView'
import { MindmapTreeView } from './MindmapTreeView'

const MindmapTreeById = ({
  treeId,
  drag,
  onNodePointerDown
}: {
  treeId: NodeId
  drag: ReturnType<typeof useMindmapDraft>
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

export const MindmapSceneLayer = ({
  onNodePointerDown
}: {
  onNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}) => {
  const instance = useInternalInstance()
  const treeIds = useStoreValue(instance.read.mindmap.list)
  const drag = useMindmapDraft(instance.draft.mindmap)

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
