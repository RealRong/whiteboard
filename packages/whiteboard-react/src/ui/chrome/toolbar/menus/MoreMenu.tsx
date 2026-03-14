import type { NodeToolbarMenuProps } from '../model'
import { resolveNodeActions } from '../../../../features/node/nodeActions'
import {
  deleteNodes,
  duplicateNodes
} from '../../../../features/node/actions'
import {
  ToolbarChip,
  ToolbarChipColumn
} from './ui'

export const MoreMenu = ({
  instance,
  nodes,
  close
}: NodeToolbarMenuProps) => {
  const actions = resolveNodeActions(nodes)
  const nodeIds = nodes.map((node) => node.id)

  return (
    <ToolbarChipColumn>
      <ToolbarChip
        disabled={!actions.canDuplicate}
        onClick={() => {
          void duplicateNodes(instance, nodeIds).finally(close)
        }}
      >
        Duplicate
      </ToolbarChip>
      <ToolbarChip
        disabled={!actions.canDelete}
        onClick={() => {
          void deleteNodes(instance, nodeIds).finally(close)
        }}
      >
        Delete
      </ToolbarChip>
    </ToolbarChipColumn>
  )
}
