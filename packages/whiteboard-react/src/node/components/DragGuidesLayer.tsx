import type { Guide } from 'types/node/snap'
import { useDragGuides } from '../hooks'

type DragGuidesLayerProps = {
  guides?: Guide[]
}

export const DragGuidesLayer = ({ guides }: DragGuidesLayerProps) => {
  const { guides: atomGuides } = useDragGuides()
  const resolvedGuides = guides ?? atomGuides
  if (!resolvedGuides.length) return null
  return (
    <svg width="100%" height="100%" className="wb-drag-guides-layer">
      {resolvedGuides.map((guide, index) => {
        if (guide.axis === 'x') {
          return (
            <line
              key={`x-${index}`}
              x1={guide.value}
              y1={guide.from}
              x2={guide.value}
              y2={guide.to}
              stroke="rgba(59,130,246,0.9)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
          )
        }
        return (
          <line
            key={`y-${index}`}
            x1={guide.from}
            y1={guide.value}
            x2={guide.to}
            y2={guide.value}
            stroke="rgba(59,130,246,0.9)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )
      })}
    </svg>
  )
}
