import type { EdgeId } from '@whiteboard/core/types'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EdgePathEntry
} from '@whiteboard/engine'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback } from 'react'
import { useInstance, useReadGetter, useWhiteboardSelector } from '../../common/hooks'
import { resolveEdgePathEntryWithRoutingDraft } from '../interaction/routingPreviewMath'
import {
  useEdgeRoutingPreviewState,
  type RoutingPreviewDraft
} from '../interaction/routingPreviewState'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'
import { useEdgePathInteraction } from '../hooks/useEdgePathInteraction'

const useEdgePath = (edgeId: EdgeId) => {
  const instance = useInstance()
  return useReadGetter<EdgePathEntry | undefined>(
    () => instance.read.projection.edge.byId.get(edgeId),
    { keys: [READ_SUBSCRIPTION_KEYS.snapshot] }
  )
}

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  routingDraft?: RoutingPreviewDraft
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
    routingDraft,
    onEdgePathPointerDown
  }: EdgeItemByIdProps) => {
    const instance = useInstance()
    const path = useEdgePath(edgeId)
    if (!path) return null
    const resolvedPath = resolveEdgePathEntryWithRoutingDraft(
      path,
      instance.query.canvas.nodeRect,
      routingDraft
    )

    return (
      <EdgeItem
        edge={resolvedPath.edge}
        path={resolvedPath.path}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={(event) => {
          onEdgePathPointerDown(event, resolvedPath)
        }}
      />
    )
  },
  (prev, next) =>
    prev.edgeId === next.edgeId &&
    prev.hitTestThresholdScreen === next.hitTestThresholdScreen &&
    prev.selected === next.selected &&
    prev.routingDraft === next.routingDraft &&
    prev.onEdgePathPointerDown === next.onEdgePathPointerDown
)

export const EdgeLayer = () => {
  const instance = useInstance()
  const { draft } = useEdgeRoutingPreviewState()
  const { handleEdgePathPointerDown } = useEdgePathInteraction()
  const edgeIds = useReadGetter(
    () => instance.read.projection.edge.ids,
    { keys: [READ_SUBSCRIPTION_KEYS.snapshot] }
  )
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: [READ_STATE_KEYS.selection]
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
          routingDraft={draft?.edgeId === edgeId ? draft : undefined}
          onEdgePathPointerDown={handleEdgePointerDown}
        />
      ))}
    </svg>
  )
}
