import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type { SelectedEdgeView } from '../hooks/useEdgeView'

export const EdgeSelectedControls = ({
  view,
  onRoutingPointerDown,
  onRoutingKeyDown
}: {
  view: SelectedEdgeView
  onRoutingPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    edgeId: SelectedEdgeView['edgeId'],
    index: number
  ) => void
  onRoutingKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    edgeId: SelectedEdgeView['edgeId'],
    index: number
  ) => void
}) => (
  <>
    <div className="wb-edge-endpoint-layer">
      <div
        data-selection-ignore
        data-input-role="edge-endpoint-handle"
        data-edge-id={view.edgeId}
        data-edge-end="source"
        className="wb-edge-endpoint-handle"
        style={{
          '--wb-edge-endpoint-x': view.endpoints.source.point.x,
          '--wb-edge-endpoint-y': view.endpoints.source.point.y
        } as CSSProperties}
      />
      <div
        data-selection-ignore
        data-input-role="edge-endpoint-handle"
        data-edge-id={view.edgeId}
        data-edge-end="target"
        className="wb-edge-endpoint-handle"
        style={{
          '--wb-edge-endpoint-x': view.endpoints.target.point.x,
          '--wb-edge-endpoint-y': view.endpoints.target.point.y
        } as CSSProperties}
      />
    </div>
    {view.routingHandles.length > 0 && (
      <div className="wb-edge-control-point-layer">
        {view.routingHandles.map((handle) => (
          <div
            key={handle.key}
            data-selection-ignore
            className="wb-edge-control-point-handle"
            data-active={handle.active ? 'true' : undefined}
            data-input-role="edge-routing-point"
            data-edge-id={handle.edgeId}
            data-routing-index={handle.index}
            onPointerDown={(event) => {
              onRoutingPointerDown(event, handle.edgeId, handle.index)
            }}
            onKeyDown={(event) => {
              onRoutingKeyDown(event, handle.edgeId, handle.index)
            }}
            style={{
              '--wb-edge-control-point-x': handle.point.x,
              '--wb-edge-control-point-y': handle.point.y,
              '--wb-edge-control-point-scale': handle.active ? 1.08 : 1
            } as CSSProperties}
            tabIndex={0}
          />
        ))}
      </div>
    )}
  </>
)
