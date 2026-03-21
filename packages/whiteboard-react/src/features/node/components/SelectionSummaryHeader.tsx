import {
  ArrowRight,
  Circle,
  Diamond,
  Folder,
  Highlighter,
  MessageSquare,
  PencilLine,
  Shapes,
  Square,
  StickyNote,
  Triangle,
  Type,
  type LucideIcon
} from 'lucide-react'
import {
  readNodeSummaryDetail,
  readNodeSummaryTitle,
  type NodeSummary,
  type NodeTypeSummary
} from '../summary'

const PreviewLimit = 3

const IconByName: Record<string, LucideIcon> = {
  text: Type,
  sticky: StickyNote,
  group: Folder,
  rect: Square,
  ellipse: Circle,
  diamond: Diamond,
  triangle: Triangle,
  'arrow-sticker': ArrowRight,
  callout: MessageSquare,
  highlight: Highlighter,
  draw: PencilLine
}

export const NodeTypeIcon = ({
  icon,
  size = 14,
  strokeWidth = 1.5,
  className
}: {
  icon: string
  size?: number
  strokeWidth?: number
  className?: string
}) => {
  const Icon = IconByName[icon] ?? Shapes

  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      absoluteStrokeWidth
      className={className}
      aria-hidden="true"
    />
  )
}

export const SelectionTypeFilterStrip = ({
  types,
  onSelect
}: {
  types: readonly NodeTypeSummary[]
  onSelect: (type: string) => void
}) => (
  <div className="wb-selection-filter-strip">
    {types.map((item) => (
      <button
        key={item.type}
        type="button"
        className="wb-selection-filter-chip"
        onClick={() => {
          onSelect(item.type)
        }}
        title={`Keep only ${item.name}`}
        data-selection-ignore
        data-input-ignore
      >
        <span className="wb-selection-filter-chip-icon">
          <NodeTypeIcon icon={item.icon} />
        </span>
        <span className="wb-selection-filter-chip-label">{item.name}</span>
        {item.count > 1 ? (
          <span className="wb-selection-filter-chip-count">{item.count}</span>
        ) : null}
      </button>
    ))}
  </div>
)

export const SelectionSummaryHeader = ({
  summary
}: {
  summary: NodeSummary
}) => {
  const types = summary.types.slice(0, PreviewLimit)
  const overflow = Math.max(0, summary.types.length - types.length)
  const detail = readNodeSummaryDetail(summary)

  if (!summary.count || !types.length) {
    return null
  }

  return (
    <div className="wb-selection-summary">
      <div className="wb-selection-summary-icons" data-mixed={summary.mixed ? 'true' : undefined}>
        {types.map((item) => (
          <span
            key={item.type}
            className="wb-selection-summary-icon"
            title={item.name}
          >
            <NodeTypeIcon icon={item.icon} />
          </span>
        ))}
        {overflow > 0 ? (
          <span className="wb-selection-summary-overflow">+{overflow}</span>
        ) : null}
      </div>
      <div className="wb-selection-summary-body">
        <div className="wb-selection-summary-title">
          {readNodeSummaryTitle(summary)}
        </div>
        {detail ? (
          <div className="wb-selection-summary-detail">{detail}</div>
        ) : null}
      </div>
    </div>
  )
}
