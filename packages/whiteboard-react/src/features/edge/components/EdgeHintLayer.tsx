import { useInternalInstance } from '../../../runtime/hooks'
import { useEdgeConnectSession } from '../session/connect'

export const EdgePreview = () => {
  const instance = useInternalInstance()
  const preview = useEdgeConnectSession(instance.internals.edge.connection)
  const { activePointerId, from, to, snap, showPreviewLine } = preview
  const zoom = instance.viewport.get().zoom
  const pointRadius = 4 / Math.max(zoom, 0.0001)
  const snapRadius = 6 / Math.max(zoom, 0.0001)
  const strokeWidth = 2 / Math.max(zoom, 0.0001)

  if (!from && !to && !snap) return null

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-edge-preview-layer"
    >
      {showPreviewLine && from && to && (
        <>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="var(--wb-preview-line)"
            strokeWidth={strokeWidth}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={from.x} cy={from.y} r={pointRadius} fill="var(--wb-text-primary)" className="wb-edge-preview-point" />
          <circle cx={to.x} cy={to.y} r={pointRadius} fill="var(--wb-text-primary)" className="wb-edge-preview-point" />
        </>
      )}
      {snap && (
        <circle
          cx={snap.x}
          cy={snap.y}
          r={snapRadius}
          fill="var(--wb-selection-fill)"
          stroke="var(--wb-accent)"
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
          className="wb-edge-preview-point"
          data-active={activePointerId !== undefined ? 'true' : 'false'}
        />
      )}
    </svg>
  )
}
