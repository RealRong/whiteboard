import type { Edge, EdgeId } from '@whiteboard/core/types'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { memo } from 'react'
import {
  useEdge,
  useEdgeIds,
  useInstance
} from '../../common/hooks'
import { useSelectedEdgeId } from '../../selection'
import { resolveEdgeEntryWithRoutingDraft } from '../interaction/routingPreviewMath'
import {
  useEdgeRoutingDraft,
  type RoutingPreviewDraft
} from '../interaction/routingPreviewState'
import { EdgeItem } from './EdgeItem'
import { useEdgePathInteraction } from '../hooks/useEdgePathInteraction'
import { EDGE_ARROW_END_ID, EDGE_ARROW_START_ID } from '../constants'

type EdgeItemByIdProps = {
  edgeId: EdgeId
  hitTestThresholdScreen: number
  selected: boolean
  routingDraft?: RoutingPreviewDraft
  onEdgePathPointerDown: (
    event: ReactPointerEvent<SVGPathElement>,
    edge: Edge
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
    const entry = useEdge(edgeId)
    if (!entry) return null
    const resolvedEntry = resolveEdgeEntryWithRoutingDraft(entry, routingDraft)

    return (
      <EdgeItem
        entry={resolvedEntry}
        hitTestThresholdScreen={hitTestThresholdScreen}
        selected={selected}
        onPathPointerDown={(event) => {
          onEdgePathPointerDown(event, resolvedEntry.edge)
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
  const draft = useEdgeRoutingDraft()
  const { handleEdgePathPointerDown } = useEdgePathInteraction()
  const edgeIds = useEdgeIds()
  const selectedEdgeId = useSelectedEdgeId()
  const hitTestThresholdScreen = instance.config.edge.hitTestThresholdScreen

  return (
    <svg width="100%" height="100%" className="wb-edge-layer">
      <defs>
        <marker
          id={EDGE_ARROW_END_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="10"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
        <marker
          id={EDGE_ARROW_START_ID}
          markerWidth="10"
          markerHeight="10"
          viewBox="0 0 10 10"
          refX="0"
          refY="5"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M 10 0 L 0 5 L 10 10 z" fill="currentColor" stroke="currentColor" />
        </marker>
      </defs>
      {edgeIds.map((edgeId) => (
        <EdgeItemById
          key={edgeId}
          edgeId={edgeId}
          hitTestThresholdScreen={hitTestThresholdScreen}
          selected={edgeId === selectedEdgeId}
          routingDraft={draft?.edgeId === edgeId ? draft : undefined}
          onEdgePathPointerDown={handleEdgePathPointerDown}
        />
      ))}
    </svg>
  )
}
