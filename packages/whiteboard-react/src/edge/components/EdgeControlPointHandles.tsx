import type { CSSProperties } from 'react'
import {
  READ_STATE_KEYS,
  READ_SUBSCRIPTION_KEYS
} from '@whiteboard/engine'
import { useInstance, useReadGetter, useWhiteboardSelector } from '../../common/hooks'
import { resolveRoutingPointsWithDraft } from '../interaction/routingPreviewMath'
import { useEdgeRoutingPreviewState } from '../interaction/routingPreviewState'
import { useEdgeRoutingInteraction } from '../hooks/useEdgeRoutingInteraction'

export const EdgeControlPointHandles = () => {
  const selectedEdgeId = useWhiteboardSelector(
    (state) => state.selection.selectedEdgeId,
    { keys: [READ_STATE_KEYS.selection] }
  )
  const instance = useInstance()
  const edgeEntry = useReadGetter(
    () => (
      selectedEdgeId
        ? instance.read.projection.edge.byId.get(selectedEdgeId)
        : undefined
    ),
    {
      keys: [READ_STATE_KEYS.selection, READ_SUBSCRIPTION_KEYS.projection]
    }
  )
  const { draft } = useEdgeRoutingPreviewState()
  const {
    handleRoutingPointerDown,
    handleRoutingKeyDown
  } = useEdgeRoutingInteraction()
  const edge = edgeEntry?.edge
  const points = edge
    ? resolveRoutingPointsWithDraft(edge.id, edge.routing?.points ?? [], draft)
    : []
  const activeIndex = edge && draft && draft.edgeId === edge.id ? draft.index : null

  if (!edge || points.length === 0 || edge.type === 'bezier' || edge.type === 'curve') return null

  return (
    <div className="wb-edge-control-point-layer">
      {points.map((point, index) => (
        <div
          key={`${edge.id}-point-${index}`}
          data-selection-ignore
          className="wb-edge-control-point-handle"
          data-active={index === activeIndex ? 'true' : undefined}
          data-input-role="edge-routing-point"
          data-edge-id={edge.id}
          data-routing-index={index}
          onPointerDown={(event) => {
            handleRoutingPointerDown(event, edge.id, index)
          }}
          onKeyDown={(event) => {
            handleRoutingKeyDown(event, edge.id, index)
          }}
          style={{
            '--wb-edge-control-point-x': point.x,
            '--wb-edge-control-point-y': point.y,
            '--wb-edge-control-point-scale': index === activeIndex ? 1.08 : 1
          } as CSSProperties}
          tabIndex={0}
        />
      ))}
    </div>
  )
}
