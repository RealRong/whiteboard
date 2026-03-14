import type { Node, NodeId } from '@whiteboard/core/types'
import { resolveNodeActions, type NodeActions } from '../../../../runtime/view/selection'
import {
  deleteNodes,
  duplicateNodes,
  groupNodes,
  setNodesLocked,
  ungroupNodes
} from '../../../../features/node/actions'
import {
  closeAfter,
  closeAfterSelectNodes,
} from '../commands'
import type { ContextMenuItem, ContextMenuSection } from '../types'

const buildDuplicateItem = ({
  key,
  nodeIds,
  disabled
}: {
  key: string
  nodeIds: readonly NodeId[]
  disabled: boolean
}): ContextMenuItem => ({
  key,
  label: 'Duplicate',
  disabled,
  run: ({ instance, close }) => {
    closeAfter(duplicateNodes(instance, nodeIds), close)
  }
})

const buildDeleteItem = ({
  key,
  nodeIds,
  disabled
}: {
  key: string
  nodeIds: readonly NodeId[]
  disabled: boolean
}): ContextMenuItem => ({
  key,
  label: 'Delete',
  tone: 'danger',
  disabled,
  run: ({ instance, close }) => {
    closeAfter(deleteNodes(instance, nodeIds), close)
  }
})

const buildLockItem = ({
  key,
  nodes,
  actions
}: {
  key: string
  nodes: readonly Node[]
  actions: NodeActions
}): ContextMenuItem => ({
  key,
  label: actions.lockLabel,
  disabled: !actions.canLock && !actions.canUnlock,
  run: ({ instance, close }) => {
    closeAfter(setNodesLocked(instance, nodes, !actions.allLocked), close)
  }
})

const buildArrangeSection = (
  nodeIds: readonly NodeId[]
): ContextMenuSection => ({
  key: 'arrange',
  title: 'Arrange',
  items: [
    {
      key: 'arrange.front',
      label: 'Bring to front',
      run: ({ instance, close }) => {
        closeAfterSelectNodes(
          instance,
          nodeIds,
          instance.commands.node.order.bringToFront([...nodeIds]),
          close
        )
      }
    },
    {
      key: 'arrange.forward',
      label: 'Bring forward',
      run: ({ instance, close }) => {
        closeAfterSelectNodes(
          instance,
          nodeIds,
          instance.commands.node.order.bringForward([...nodeIds]),
          close
        )
      }
    },
    {
      key: 'arrange.backward',
      label: 'Send backward',
      run: ({ instance, close }) => {
        closeAfterSelectNodes(
          instance,
          nodeIds,
          instance.commands.node.order.sendBackward([...nodeIds]),
          close
        )
      }
    },
    {
      key: 'arrange.back',
      label: 'Send to back',
      run: ({ instance, close }) => {
        closeAfterSelectNodes(
          instance,
          nodeIds,
          instance.commands.node.order.sendToBack([...nodeIds]),
          close
        )
      }
    }
  ]
})

export const buildNodeSections = (
  node: Node
): readonly ContextMenuSection[] => {
  const actions = resolveNodeActions([node])
  const nodeIds = actions.nodeIds
  const items: ContextMenuItem[] = [
    buildDuplicateItem({
      key: 'node.duplicate',
      nodeIds,
      disabled: !actions.canDuplicate
    }),
    buildDeleteItem({
      key: 'node.delete',
      nodeIds,
      disabled: !actions.canDelete
    }),
    buildLockItem({
      key: 'node.lock',
      nodes: [node],
      actions
    })
  ]

  const sections: ContextMenuSection[] = [
    {
      key: 'node.actions',
      items
    },
    buildArrangeSection(nodeIds)
  ]

  if (node.type === 'group') {
    const collapsed = Boolean(node.data?.collapsed)
    const autoFit = node.data?.autoFit === 'manual' ? 'manual' : 'expand-only'
    sections.push({
      key: 'group',
      title: 'Group',
      items: [
        {
          key: 'group.toggle-collapse',
          label: collapsed ? 'Expand' : 'Collapse',
          run: ({ instance, close }) => {
            closeAfterSelectNodes(
              instance,
              [node.id],
              instance.commands.node.updateData(node.id, { collapsed: !collapsed }),
              close
            )
          }
        },
        {
          key: 'group.auto-fit-expand-only',
          label: autoFit === 'expand-only'
            ? 'Auto fit: expand-only'
            : 'Set auto fit: expand-only',
          run: ({ instance, close }) => {
            closeAfterSelectNodes(
              instance,
              [node.id],
              instance.commands.node.updateData(node.id, { autoFit: 'expand-only' }),
              close
            )
          }
        },
        {
          key: 'group.auto-fit-manual',
          label: autoFit === 'manual'
            ? 'Auto fit: manual'
            : 'Set auto fit: manual',
          run: ({ instance, close }) => {
            closeAfterSelectNodes(
              instance,
              [node.id],
              instance.commands.node.updateData(node.id, { autoFit: 'manual' }),
              close
            )
          }
        }
      ]
    })
  }

  return sections
}

export const buildNodesSections = (
  nodes: readonly Node[]
): readonly ContextMenuSection[] => {
  const actions = resolveNodeActions(nodes)
  const nodeIds = actions.nodeIds

  return [
    {
      key: 'nodes.actions',
      items: [
        buildDuplicateItem({
          key: 'nodes.duplicate',
          nodeIds,
          disabled: !actions.canDuplicate
        }),
        buildDeleteItem({
          key: 'nodes.delete',
          nodeIds,
          disabled: !actions.canDelete
        }),
        buildLockItem({
          key: 'nodes.lock',
          nodes,
          actions
        }),
        {
          key: 'nodes.group',
          label: 'Group',
          disabled: !actions.canGroup,
          run: ({ instance, close }) => {
            closeAfter(groupNodes(instance, nodeIds), close)
          }
        },
        {
          key: 'nodes.ungroup',
          label: 'Ungroup',
          disabled: !actions.canUngroup,
          run: ({ instance, close }) => {
            closeAfter(ungroupNodes(instance, nodeIds), close)
          }
        }
      ]
    },
    buildArrangeSection(nodeIds)
  ]
}
