import type { NodeTypeSummary } from '../summary'
import { NodeTypeIcon } from './NodeTypeIcon'

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
