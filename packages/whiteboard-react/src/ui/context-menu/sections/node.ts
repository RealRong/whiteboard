import type { Node, NodeId } from '@whiteboard/core/types'
import { resolveNodeCaps, type NodeCaps } from '../../../runtime/nodeCaps'
import {
  deleteNodes,
  duplicateNodes,
  groupNodes,
  selectNodeIds,
  setNodesLocked,
  ungroupNodes
} from '../../../features/node/commands'
import type { ContextMenuItem, ContextMenuSection } from '../types'

const closeAfter = (
  effect: Promise<unknown>,
  close: () => void
) => {
  void effect.finally(close)
}

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
    if (disabled) return
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
    if (disabled) return
    closeAfter(deleteNodes(instance, nodeIds), close)
  }
})

const buildLockItem = ({
  key,
  nodeIds,
  caps
}: {
  key: string
  nodeIds: readonly NodeId[]
  caps: NodeCaps
}): ContextMenuItem => ({
  key,
  label: caps.lockLabel,
  disabled: !caps.canLock && !caps.canUnlock,
  run: ({ instance, close }) => {
    const nodes = nodeIds
      .map((nodeId) => instance.read.node.item.get(nodeId)?.node)
      .filter((node): node is NonNullable<typeof node> => Boolean(node))
    if (!nodes.length) {
      close()
      return
    }
    closeAfter(setNodesLocked(instance, nodes, !caps.allLocked), close)
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
        void instance.commands.node.order.bringToFront([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.forward',
      label: 'Bring forward',
      run: ({ instance, close }) => {
        void instance.commands.node.order.bringForward([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.backward',
      label: 'Send backward',
      run: ({ instance, close }) => {
        void instance.commands.node.order.sendBackward([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    },
    {
      key: 'arrange.back',
      label: 'Send to back',
      run: ({ instance, close }) => {
        void instance.commands.node.order.sendToBack([...nodeIds])
          .then((result) => {
            if (!result.ok) return
            selectNodeIds(instance, nodeIds)
          })
          .finally(close)
      }
    }
  ]
})

const buildGroupSection = (
  node: Node
): ContextMenuSection => {
  const collapsed = Boolean(node.data?.collapsed)
  const autoFit = node.data?.autoFit === 'manual' ? 'manual' : 'expand-only'

  return {
    key: 'group',
    title: 'Group',
    items: [
      {
        key: 'group.toggle-collapse',
        label: collapsed ? 'Expand' : 'Collapse',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            collapsed: !collapsed
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      },
      {
        key: 'group.auto-fit-expand-only',
        label: autoFit === 'expand-only'
          ? 'Auto fit: expand-only'
          : 'Set auto fit: expand-only',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            autoFit: 'expand-only'
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      },
      {
        key: 'group.auto-fit-manual',
        label: autoFit === 'manual'
          ? 'Auto fit: manual'
          : 'Set auto fit: manual',
        run: ({ instance, close }) => {
          void instance.commands.node.updateData(node.id, {
            autoFit: 'manual'
          })
            .then((result) => {
              if (!result.ok) return
              selectNodeIds(instance, [node.id])
            })
            .finally(close)
        }
      }
    ]
  }
}

export const buildNodeSections = (
  node: Node
): readonly ContextMenuSection[] => {
  const caps = resolveNodeCaps([node])
  const nodeIds = caps.nodeIds
  const sections: ContextMenuSection[] = [
    {
      key: 'node.actions',
      items: [
        buildDuplicateItem({
          key: 'node.duplicate',
          nodeIds,
          disabled: !caps.canDuplicate
        }),
        buildDeleteItem({
          key: 'node.delete',
          nodeIds,
          disabled: !caps.canDelete
        }),
        buildLockItem({
          key: 'node.lock',
          nodeIds,
          caps
        })
      ]
    },
    buildArrangeSection(nodeIds)
  ]

  if (node.type === 'group') {
    sections.push(buildGroupSection(node))
  }

  return sections
}

export const buildNodesSections = (
  nodes: readonly Node[]
): readonly ContextMenuSection[] => {
  const caps = resolveNodeCaps(nodes)
  const nodeIds = caps.nodeIds

  return [
    {
      key: 'nodes.actions',
      items: [
        buildDuplicateItem({
          key: 'nodes.duplicate',
          nodeIds,
          disabled: !caps.canDuplicate
        }),
        buildDeleteItem({
          key: 'nodes.delete',
          nodeIds,
          disabled: !caps.canDelete
        }),
        buildLockItem({
          key: 'nodes.lock',
          nodeIds,
          caps
        }),
        {
          key: 'nodes.group',
          label: 'Group',
          disabled: !caps.canGroup,
          run: ({ instance, close }) => {
            if (!caps.canGroup) return
            closeAfter(groupNodes(instance, nodeIds), close)
          }
        },
        {
          key: 'nodes.ungroup',
          label: 'Ungroup',
          disabled: !caps.canUngroup,
          run: ({ instance, close }) => {
            if (!caps.canUngroup) return
            closeAfter(ungroupNodes(instance, nodeIds), close)
          }
        }
      ]
    },
    buildArrangeSection(nodeIds)
  ]
}
