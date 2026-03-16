import type { NodeToolbarActionContext } from '../types'
import { resolveNodeCaps } from '../../../runtime/nodeCaps'
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
  const caps = resolveNodeCaps(nodes)
  const nodeIds = caps.nodeIds

  return (
    <ToolbarChipColumn>
      <ToolbarChip
        disabled={!caps.canDuplicate}
        onClick={() => {
          void duplicateNodes(instance, nodeIds).finally(close)
        }}
      >
        Duplicate
      </ToolbarChip>
      <ToolbarChip
        disabled={!caps.canDelete}
        onClick={() => {
          void deleteNodes(instance, nodeIds).finally(close)
        }}
      >
        Delete
      </ToolbarChip>
    </ToolbarChipColumn>
  )
}
