import { useWhiteboardSelector } from '../../common/hooks'

export const DragGuidesLayer = () => {
  const guides = useWhiteboardSelector('dragGuides')

  if (!guides.length) return null

  return (
    <svg width="100%" height="100%" className="wb-drag-guides-layer">
      {guides.map((guide, index) => {
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
