import type { NodeId } from '@whiteboard/core'
import { useEffect, useState } from 'react'
import { MindmapLayer } from './MindmapLayer'
import { useInstance, useMindmapDragView } from '../../common/hooks'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useMindmapTreeIds = () => {
  const instance = useInstance()
  const [treeIds, setTreeIds] = useState<NodeId[]>(() => instance.view.mindmap.ids())

  useEffect(() => {
    const update = () => {
      const next = instance.view.mindmap.ids()
      setTreeIds((prev) => (isSameIdOrder(prev, next) ? prev : next))
    }
    update()
    return instance.view.mindmap.watchIds(update)
  }, [instance])

  return treeIds
}

export const MindmapLayerStack = () => {
  const treeIds = useMindmapTreeIds()
  const drag = useMindmapDragView()
  return <MindmapLayer treeIds={treeIds} drag={drag} />
}
