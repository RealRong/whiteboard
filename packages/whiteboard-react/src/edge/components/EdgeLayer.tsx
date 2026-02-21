import type { EdgeId } from '@whiteboard/core'
import type { EdgePathEntry } from '@whiteboard/engine'
import { memo, useEffect, useState } from 'react'
import { useInstance, useWhiteboardSelector } from '../../common/hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useEdgeIds = () => {
  const instance = useInstance()
  const [edgeIds, setEdgeIds] = useState<EdgeId[]>(() => instance.view.edge.ids())

  useEffect(() => {
    const update = () => {
      const next = instance.view.edge.ids()
      setEdgeIds((prev) => (isSameIdOrder(prev, next) ? prev : next))
    }
    update()
    return instance.view.edge.watchIds(update)
  }, [instance])

  return edgeIds
}

const useEdgePath = (edgeId: EdgeId) => {
  const instance = useInstance()
  const [path, setPath] = useState<EdgePathEntry | undefined>(() => instance.view.edge.path(edgeId))

  useEffect(() => {
    const update = () => {
      const next = instance.view.edge.path(edgeId)
      setPath((prev) => (Object.is(prev, next) ? prev : next))
    }
    update()
    return instance.view.edge.watchPath(edgeId, update)
  }, [edgeId, instance])

  return path
}

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
}

const EdgeItemById = memo(
  ({
    edgeId,
    hitTestThresholdScreen,
    selected
  }: EdgeItemByIdProps) => {
    const path = useEdgePath(edgeId)
    if (!path) return null

    return (
      <EdgeItem
        edge={path.edge}
        path={path.path}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
      />
    )
  },
  (prev, next) =>
    prev.edgeId === next.edgeId &&
    prev.hitTestThresholdScreen === next.hitTestThresholdScreen &&
    prev.selected === next.selected
)

export const EdgeLayer = () => {
  const instance = useInstance()
  const edgeIds = useEdgeIds()
  const stateSelectedEdgeId = useWhiteboardSelector('edgeSelection')
  const hitTestThresholdScreen = instance.runtime.config.edge.hitTestThresholdScreen

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <EdgeMarkerDefs />
      {edgeIds.map((edgeId) => (
        <EdgeItemById
          key={edgeId}
          edgeId={edgeId}
          hitTestThresholdScreen={hitTestThresholdScreen}
          selected={edgeId === stateSelectedEdgeId}
        />
      ))}
    </svg>
  )
}
