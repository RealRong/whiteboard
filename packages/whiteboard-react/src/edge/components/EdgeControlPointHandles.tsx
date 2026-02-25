import type { CSSProperties } from 'react'
import { useEdgeSelectedRoutingView, useWhiteboardRenderSelector } from '../../common/hooks'
import { useEdgeRoutingInteraction } from '../hooks/useEdgeRoutingInteraction'

export const EdgeControlPointHandles = () => {
  const selectedRouting = useEdgeSelectedRoutingView()
  const routingDrag = useWhiteboardRenderSelector('routingDrag')
  const { handleRoutingPointerDown } = useEdgeRoutingInteraction()
  const edge = selectedRouting?.edge
  const points = selectedRouting?.points ?? []
  const activeDrag = routingDrag.payload
  const activeIndex = edge && activeDrag && activeDrag.edgeId === edge.id ? activeDrag.index : null

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
