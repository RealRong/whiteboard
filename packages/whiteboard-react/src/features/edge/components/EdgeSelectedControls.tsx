import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent
} from 'react'
import type {
  SelectedEdgePathPointView,
  SelectedEdgeView
} from '../hooks/useEdgeView'

export const EdgeSelectedControls = ({
  view,
  onEndpointPointerDown,
  onPathPointPointerDown,
  onPathPointKeyDown
}: {
  view: SelectedEdgeView
  onEndpointPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>
  ) => void
  onPathPointPointerDown: (
    event: ReactPointerEvent<HTMLDivElement>,
    point: SelectedEdgePathPointView
  ) => void
  onPathPointKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    point: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
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
        onPointerDown={onEndpointPointerDown}
        style={{
          '--wb-edge-endpoint-x': view.ends.source.point.x,
          '--wb-edge-endpoint-y': view.ends.source.point.y
        } as CSSProperties}
      />
      <div
        data-selection-ignore
        data-input-role="edge-endpoint-handle"
        data-edge-id={view.edgeId}
        data-edge-end="target"
        className="wb-edge-endpoint-handle"
        onPointerDown={onEndpointPointerDown}
        style={{
          '--wb-edge-endpoint-x': view.ends.target.point.x,
          '--wb-edge-endpoint-y': view.ends.target.point.y
        } as CSSProperties}
      />
    </div>
    {view.pathPoints.length > 0 && (
      <div className="wb-edge-control-point-layer">
        {view.pathPoints.map((point) => (
          <div
            key={point.key}
            data-selection-ignore
            className="wb-edge-control-point-handle"
            data-kind={point.kind}
            data-active={point.active ? 'true' : undefined}
            data-input-role={point.kind === 'anchor' ? 'edge-path-anchor' : 'edge-path-insert'}
            data-edge-id={point.edgeId}
            data-path-index={point.kind === 'anchor' ? point.index : undefined}
            data-path-insert-index={point.kind === 'insert' ? point.insertIndex : undefined}
            onPointerDown={(event) => {
              onPathPointPointerDown(event, point)
            }}
            onKeyDown={point.kind === 'anchor'
              ? (event) => {
                  onPathPointKeyDown(event, point)
                }
              : undefined}
            style={{
              '--wb-edge-control-point-x': point.point.x,
              '--wb-edge-control-point-y': point.point.y,
              '--wb-edge-control-point-scale': point.active ? 1.08 : 1
            } as CSSProperties}
            tabIndex={0}
          />
        ))}
      </div>
    )}
  </>
)
