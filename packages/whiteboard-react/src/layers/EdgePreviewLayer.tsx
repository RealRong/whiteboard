import type { Point } from '@whiteboard/core'

type EdgePreviewLayerProps = {
  from?: Point
  to?: Point
  snap?: Point
}

export const EdgePreviewLayer = ({ from, to, snap }: EdgePreviewLayerProps) => {
  if (!from && !to && !snap) return null
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 9 }}
    >
      {from && to && (
        <>
          <line
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke="rgba(17,24,39,0.7)"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
          <circle cx={from.x} cy={from.y} r={4} fill="#111827" />
          <circle cx={to.x} cy={to.y} r={4} fill="#111827" />
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
        />
      )}
    </svg>
  )
}
