import type { MindmapNodeId, NodeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'
import { useMindmapDrag } from '../hooks/drag/useMindmapDrag'
import { useMindmapTreeView } from '../hooks/useMindmapTreeView'
import { MindmapTreeView } from './MindmapTreeView'

const MindmapTreeById = ({
  treeId,
  handleNodePointerDown
}: {
  treeId: NodeId
  handleNodePointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    treeId: NodeId,
    nodeId: MindmapNodeId
  ) => void
}) => {
  const view = useMindmapTreeView(treeId)

  if (!view) return null

  return (
    <MindmapTreeView
      view={view}
      onNodePointerDown={handleNodePointerDown}
    />
  )
}

export const MindmapSceneLayer = () => {
  const instance = useInternalInstance()
  const treeIds = useStoreValue(instance.read.mindmap.list)
  const {
    handleMindmapNodePointerDown
  } = useMindmapDrag()

  if (!treeIds.length) return null

  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeById
          key={treeId}
          treeId={treeId}
          handleNodePointerDown={handleMindmapNodePointerDown}
        />
      ))}
    </>
  )
}
