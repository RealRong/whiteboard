import { useInternalInstance } from '../../../runtime/hooks'
import { useEdgeConnectSession } from '../session/connect'

export const EdgePreview = () => {
  const instance = useInternalInstance()
  const preview = useEdgeConnectSession(instance.internals.edge.connection)
  const { activePointerId, from, to, snap, showPreviewLine } = preview

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
            stroke="rgba(17,24,39,0.7)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={from.x} cy={from.y} r={4} fill="#111827" className="wb-edge-preview-point" />
          <circle cx={to.x} cy={to.y} r={4} fill="#111827" className="wb-edge-preview-point" />
        </>
      )}
      {snap && (
        <circle
          cx={snap.x}
          cy={snap.y}
          r={6}
          fill="rgba(59,130,246,0.2)"
          stroke="#2563eb"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="wb-edge-preview-point"
          data-active={activePointerId !== undefined ? 'true' : 'false'}
        />
      )}
    </svg>
  )
}
