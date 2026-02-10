import { useActiveTool } from '../../common/hooks'
import { useEdgeConnectLayerState, useEdgePreview } from '../hooks'

export const EdgePreviewLayer = () => {
  const tool = useActiveTool()
  const { state } = useEdgeConnectLayerState()
  const preview = useEdgePreview({ state })

  const resolvedFrom = state.isConnecting && !state.reconnect ? preview.previewFrom : undefined
  const resolvedTo = state.isConnecting && !state.reconnect ? preview.previewTo : undefined
  const resolvedSnap = tool === 'edge' ? preview.hoverSnap : undefined

  if (!resolvedFrom && !resolvedTo && !resolvedSnap) return null
  return (
    <svg width="100%" height="100%" className="wb-edge-preview-layer">
      {resolvedFrom && resolvedTo && (
        <>
          <line
            x1={resolvedFrom.x}
            y1={resolvedFrom.y}
            x2={resolvedTo.x}
            y2={resolvedTo.y}
            stroke="rgba(17,24,39,0.7)"
            strokeWidth={2}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={resolvedFrom.x} cy={resolvedFrom.y} r={4} fill="#111827" className="wb-edge-preview-point" />
          <circle cx={resolvedTo.x} cy={resolvedTo.y} r={4} fill="#111827" className="wb-edge-preview-point" />
        </>
      )}
      {resolvedSnap && (
        <circle
          cx={resolvedSnap.x}
          cy={resolvedSnap.y}
          r={6}
          fill="rgba(59,130,246,0.2)"
          stroke="#2563eb"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          className="wb-edge-preview-point"
        />
      )}
    </svg>
  )
}
