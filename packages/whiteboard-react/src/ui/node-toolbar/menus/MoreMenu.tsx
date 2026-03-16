import type { NodeToolbarActionContext } from '../types'
import { summarizeNodes } from '../../../features/node/summary'
import {
  deleteNodes,
  duplicateNodes
} from '../../../features/node/commands'
import {
  ToolbarChip,
  ToolbarChipColumn
} from './controls'

export const MoreMenu = ({
  instance,
  nodes,
  close
}: NodeToolbarActionContext) => {
  const summary = summarizeNodes(nodes)
  const nodeIds = summary.ids

  return (
    <ToolbarChipColumn>
      <ToolbarChip
        disabled={summary.count === 0}
        onClick={() => {
          void duplicateNodes(instance, nodeIds).finally(close)
        }}
      >
        Duplicate
      </ToolbarChip>
      <ToolbarChip
        disabled={summary.count === 0}
        onClick={() => {
          void deleteNodes(instance, nodeIds).finally(close)
        }}
      >
        Delete
      </ToolbarChip>
    </ToolbarChipColumn>
  )
}
