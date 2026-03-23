import type { NodeId } from '@whiteboard/core/types'
import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'
import { useMindmapTreeView } from '../hooks/useMindmapTreeView'
import { MindmapTreeView } from './MindmapTreeView'

const MindmapTreeById = ({
  treeId
}: {
  treeId: NodeId
}) => {
  const view = useMindmapTreeView(treeId)

  if (!view) return null

  return <MindmapTreeView view={view} />
}

export const MindmapSceneLayer = () => {
  const instance = useInternalInstance()
  const treeIds = useStoreValue(instance.read.mindmap.list)

  if (!treeIds.length) return null

  return (
    <>
      {treeIds.map((treeId) => (
        <MindmapTreeById
          key={treeId}
          treeId={treeId}
        />
      ))}
    </>
  )
}
