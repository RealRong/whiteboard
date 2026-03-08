import type { EdgeId } from '@whiteboard/core/types'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS,
  type EdgeEntry
} from '@whiteboard/engine'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo, useCallback } from 'react'
import { useInstance, useReadGetter, useWhiteboardSelector } from '../../common/hooks'
import { resolveEdgeEntryWithRoutingDraft } from '../interaction/routingPreviewMath'
import {
  useEdgeRoutingPreviewState,
  type RoutingPreviewDraft
} from '../interaction/routingPreviewState'
import { EdgeItem } from './EdgeItem'
import { EdgeMarkerDefs } from './EdgeMarkerDefs'
import { useEdgePathInteraction } from '../hooks/useEdgePathInteraction'

const useEdgeEntry = (edgeId: EdgeId) => {
  const instance = useInstance()
  return useReadGetter<EdgeEntry | undefined>(
    () => instance.read.projection.edge.byId.get(edgeId),
    { keys: [READ_SUBSCRIPTION_KEYS.edge] }
  )
}

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  routingDraft?: RoutingPreviewDraft
  onEdgePathPointerDown: (
    event: ReactPointerEvent<SVGPathElement>,
    entry: EdgeEntry
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
    const entry = useEdgeEntry(edgeId)
    if (!entry) return null
    const resolvedEntry = resolveEdgeEntryWithRoutingDraft(entry, routingDraft)

    return (
      <EdgeItem
        entry={resolvedEntry}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={(event) => {
          onEdgePathPointerDown(event, resolvedEntry)
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
    { keys: [READ_SUBSCRIPTION_KEYS.edge] }
  )
  const stateSelectedEdgeId = useWhiteboardSelector(
    (snapshot) => snapshot.selection.selectedEdgeId,
    {
      keys: ['selection']
    }
  )
  const hitTestThresholdScreen = instance.read.config.edge.hitTestThresholdScreen
  const handleEdgePointerDown = useCallback(
    (event: ReactPointerEvent<SVGPathElement>, entry: EdgeEntry) => {
      handleEdgePathPointerDown(event, entry.edge)
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
