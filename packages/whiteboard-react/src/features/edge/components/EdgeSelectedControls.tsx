import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent
} from 'react'
import { usePickRef } from '../../../runtime/hooks'
import type {
  SelectedEdgePathPointView,
  SelectedEdgeView
} from '../hooks/useEdgeView'

const EdgeEndpointHandle = ({
  edgeId,
  end,
  point
}: {
  edgeId: SelectedEdgeView['edgeId']
  end: 'source' | 'target'
  point: {
    x: number
    y: number
  }
}) => {
  const ref = usePickRef({
    kind: 'edge',
    id: edgeId,
    part: 'end',
    end
  })

  return (
    <div
      ref={ref}
      data-selection-ignore
      className="wb-edge-endpoint-handle"
      style={{
        '--wb-edge-endpoint-x': point.x,
        '--wb-edge-endpoint-y': point.y
      } as CSSProperties}
    />
  )
}

const EdgePathPointHandle = ({
  point,
  onKeyDown
}: {
  point: SelectedEdgePathPointView
  onKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    point: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
  ) => void
}) => {
  const ref = usePickRef(
    point.kind === 'anchor'
      ? {
          kind: 'edge',
          id: point.edgeId,
          part: 'path',
          index: point.index
        }
      : {
          kind: 'edge',
          id: point.edgeId,
          part: 'path',
          insert: point.insertIndex
        }
  )

  return (
    <div
      ref={ref}
      data-selection-ignore
      className="wb-edge-control-point-handle"
      data-kind={point.kind}
      data-active={point.active ? 'true' : undefined}
      onKeyDown={point.kind === 'anchor'
        ? (event) => {
            onKeyDown(event, point)
          }
        : undefined}
      style={{
        '--wb-edge-control-point-x': point.point.x,
        '--wb-edge-control-point-y': point.point.y,
        '--wb-edge-control-point-scale': point.active ? 1.08 : 1
      } as CSSProperties}
      tabIndex={0}
    />
  )
}

export const EdgeSelectedControls = ({
  view,
  onPathPointKeyDown
}: {
  view: SelectedEdgeView
  onPathPointKeyDown: (
    event: ReactKeyboardEvent<HTMLDivElement>,
    point: Extract<SelectedEdgePathPointView, { kind: 'anchor' }>
  ) => void
}) => (
  <>
    <div className="wb-edge-endpoint-layer">
      <EdgeEndpointHandle
        edgeId={view.edgeId}
        end="source"
        point={view.ends.source.point}
      />
      <EdgeEndpointHandle
        edgeId={view.edgeId}
        end="target"
        point={view.ends.target.point}
      />
    </div>
    {view.pathPoints.length > 0 && (
      <div className="wb-edge-control-point-layer">
        {view.pathPoints.map((point) => (
          <EdgePathPointHandle
            key={point.key}
            point={point}
            onKeyDown={onPathPointKeyDown}
          />
        ))}
      </div>
    )}
  </>
)
