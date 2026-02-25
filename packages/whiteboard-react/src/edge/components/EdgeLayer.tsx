import type { EdgeId } from '@whiteboard/core/types'
import type { EdgePathEntry } from '@whiteboard/engine'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback } from 'react'
import { useInstance, useViewSelector, useWhiteboardSelector } from '../../common/hooks'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'
import { useEdgePathInteraction } from '../hooks/useEdgePathInteraction'

const isSameIdOrder = (left: readonly string[], right: readonly string[]) => {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

const useEdgeIds = () => {
  return useViewSelector((state) => state.edges.ids, {
    equality: isSameIdOrder
  })
}

const useEdgePath = (edgeId: EdgeId) => {
  return useViewSelector<EdgePathEntry | undefined>(
    (state) => state.edges.byId.get(edgeId)
  )
}

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  onEdgePathPointerDown: (
    event: ReactPointerEvent<SVGPathElement>,
    entry: EdgePathEntry
  ) => void
}

const EdgeItemById = memo(
  ({
    edgeId,
    hitTestThresholdScreen,
    selected,
    onEdgePathPointerDown
  }: EdgeItemByIdProps) => {
    const path = useEdgePath(edgeId)
    if (!path) return null

    return (
      <EdgeItem
        edge={path.edge}
        path={path.path}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={(event) => {
          onEdgePathPointerDown(event, path)
        }}
      />
    )
  },
  (prev, next) =>
    prev.edgeId === next.edgeId &&
    prev.hitTestThresholdScreen === next.hitTestThresholdScreen &&
    prev.selected === next.selected &&
    prev.onEdgePathPointerDown === next.onEdgePathPointerDown
)

export const EdgeLayer = () => {
  const instance = useInstance()
  const { handleEdgePathPointerDown } = useEdgePathInteraction()
  const edgeIds = useEdgeIds()
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: ['selection']
    }
  )
  const hitTestThresholdScreen = instance.query.config.get().edge.hitTestThresholdScreen
  const handleEdgePointerDown = useCallback(
    (event: ReactPointerEvent<SVGPathElement>, entry: EdgePathEntry) => {
      handleEdgePathPointerDown(event, entry.edge, entry.path.points)
    },
    [handleEdgePathPointerDown]
  )

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <EdgeMarkerDefs />
      {edgeIds.map((edgeId) => (
        <EdgeItemById
          key={edgeId}
          edgeId={edgeId}
          hitTestThresholdScreen={hitTestThresholdScreen}
          selected={edgeId === stateSelectedEdgeId}
          onEdgePathPointerDown={handleEdgePointerDown}
        />
      ))}
    </svg>
  )
}
