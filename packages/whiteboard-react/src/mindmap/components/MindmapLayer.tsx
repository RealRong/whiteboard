import type { NodeId } from '@whiteboard/core'
import type { MindmapDragView, MindmapViewTree } from '@whiteboard/engine'
import { useEffect, useState } from 'react'
import { useInstance } from '../../common/hooks'
import { MindmapTreeView } from './MindmapTreeView'

type MindmapLayerProps = {
  treeIds: NodeId[]
  drag?: MindmapDragView
}

const useMindmapTree = (treeId: NodeId) => {
  const instance = useInstance()
  const [tree, setTree] = useState<MindmapViewTree | undefined>(() =>
    instance.view.getMindmapTree(treeId)
  )

  useEffect(() => {
    const update = () => {
      const next = instance.view.getMindmapTree(treeId)
      setTree((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.watchMindmapTree(treeId, update)
  }, [instance, treeId])

  return tree
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
