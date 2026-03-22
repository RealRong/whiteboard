import { useInternalInstance, useStoreValue } from '../../../runtime/hooks'

export const EdgeHintLayer = () => {
  const instance = useInternalInstance()
  const hint = useStoreValue(instance.internals.edge.preview.hint)
  const { line, snap } = hint
  const zoom = instance.viewport.get().zoom
  const pointRadius = 4 / Math.max(zoom, 0.0001)
  const snapRadius = 6 / Math.max(zoom, 0.0001)
  const strokeWidth = 2 / Math.max(zoom, 0.0001)

  if (!line && !snap) return null

  return (
    <svg
      width="100%"
      height="100%"
      overflow="visible"
      className="wb-edge-preview-layer"
    >
      {line && (
        <>
          <line
            x1={line.from.x}
            y1={line.from.y}
            x2={line.to.x}
            y2={line.to.y}
            stroke="var(--wb-preview-line)"
            strokeWidth={strokeWidth}
            strokeDasharray="6 4"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={line.from.x} cy={line.from.y} r={pointRadius} fill="var(--wb-text-primary)" className="wb-edge-preview-point" />
          <circle cx={line.to.x} cy={line.to.y} r={pointRadius} fill="var(--wb-text-primary)" className="wb-edge-preview-point" />
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
        />
      )}
    </svg>
  )
}
