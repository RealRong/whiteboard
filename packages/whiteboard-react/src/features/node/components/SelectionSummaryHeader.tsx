import {
  readNodeSummaryDetail,
  readNodeSummaryTitle,
  type NodeSummary
} from '../summary'
import { NodeTypeIcon } from './NodeTypeIcon'

const PreviewLimit = 3

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
