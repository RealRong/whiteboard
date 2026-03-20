import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node } from '@whiteboard/core/types'
import type { WhiteboardInstance } from '../../runtime/instance'
import {
  alignNodes,
  deleteNodes,
  distributeNodes,
  duplicateNodes,
  groupNodes,
  orderNodes,
  toggleNodesLock,
  ungroupNodes,
  type OrderMode
} from './commands'
import {
  readLockLabel,
  summarizeNodes,
  type NodeSummary
} from './summary'

type NodeActionsInstance = Pick<WhiteboardInstance, 'commands'>

type NodeActionExtras = {
  onCopy?: () => unknown
  onCut?: () => unknown
}

export type NodeMenuItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
}

export type NodeMenuSection = {
  key: string
  title: string
  items: readonly NodeMenuItem[]
}

export type NodeContextMenuItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick?: () => void
  children?: readonly NodeMenuItem[]
}

export type NodeContextMenuGroup = {
  key: string
  title?: string
  items: readonly NodeContextMenuItem[]
}

export type NodeSelectionActions = {
  summary: NodeSummary
  layer: {
    visible: boolean
    items: readonly NodeMenuItem[]
    onSelect: (mode: OrderMode) => void
  }
  layout: {
    visible: boolean
    canAlign: boolean
    canDistribute: boolean
    alignItems: readonly NodeMenuItem[]
    distributeItems: readonly NodeMenuItem[]
    onAlign: (mode: NodeAlignMode) => void
    onDistribute: (mode: NodeDistributeMode) => void
  }
  structure: {
    visible: boolean
    items: readonly NodeMenuItem[]
  }
  state: {
    visible: boolean
    items: readonly NodeMenuItem[]
  }
  edit: {
    visible: boolean
    items: readonly NodeMenuItem[]
  }
  danger: {
    visible: boolean
    items: readonly NodeMenuItem[]
  }
}

const ORDER_ITEMS: ReadonlyArray<{
  key: string
  label: string
  mode: OrderMode
}> = [
  {
    key: 'order.front',
    label: 'Bring to front',
    mode: 'front'
  },
  {
    key: 'order.forward',
    label: 'Bring forward',
    mode: 'forward'
  },
  {
    key: 'order.backward',
    label: 'Send backward',
    mode: 'backward'
  },
  {
    key: 'order.back',
    label: 'Send to back',
    mode: 'back'
  }
]

const ALIGN_ITEMS: ReadonlyArray<{
  key: string
  label: string
  mode: NodeAlignMode
}> = [
  {
    key: 'layout.align.top',
    label: 'Align top',
    mode: 'top'
  },
  {
    key: 'layout.align.left',
    label: 'Align left',
    mode: 'left'
  },
  {
    key: 'layout.align.right',
    label: 'Align right',
    mode: 'right'
  },
  {
    key: 'layout.align.bottom',
    label: 'Align bottom',
    mode: 'bottom'
  },
  {
    key: 'layout.align.horizontal',
    label: 'Align horizontal center',
    mode: 'horizontal'
  },
  {
    key: 'layout.align.vertical',
    label: 'Align vertical center',
    mode: 'vertical'
  }
]

const DISTRIBUTE_ITEMS: ReadonlyArray<{
  key: string
  label: string
  mode: NodeDistributeMode
}> = [
  {
    key: 'layout.distribute.horizontal',
    label: 'Distribute horizontally',
    mode: 'horizontal'
  },
  {
    key: 'layout.distribute.vertical',
    label: 'Distribute vertically',
    mode: 'vertical'
  }
]

export const createNodeSelectionActions = (
  instance: NodeActionsInstance,
  nodes: readonly Node[],
  extras?: NodeActionExtras
): NodeSelectionActions => {
  const summary = summarizeNodes(nodes)
  const nodeIds = summary.ids
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)

  const canOrder = summary.count > 0
  const canAlign = summary.count >= 2
  const canDistribute = summary.count >= 3
  const canGroup = summary.count >= 2
  const canUngroup = groupIds.length > 0
  const canEdit = summary.count > 0

  const onOrder = (mode: OrderMode) => {
    orderNodes(instance, nodeIds, mode)
  }

  const onAlign = (mode: NodeAlignMode) => {
    alignNodes(instance, nodeIds, mode)
  }

  const onDistribute = (mode: NodeDistributeMode) => {
    distributeNodes(instance, nodeIds, mode)
  }

  return {
    summary,
    layer: {
      visible: canOrder,
      items: ORDER_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !canOrder,
        onClick: () => {
          onOrder(item.mode)
        }
      })),
      onSelect: onOrder
    },
    layout: {
      visible: canAlign,
      canAlign,
      canDistribute,
      alignItems: ALIGN_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !canAlign,
        onClick: () => {
          onAlign(item.mode)
        }
      })),
      distributeItems: DISTRIBUTE_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !canDistribute,
        onClick: () => {
          onDistribute(item.mode)
        }
      })),
      onAlign,
      onDistribute
    },
    structure: {
      visible: canGroup || canUngroup,
      items: [
        {
          key: 'structure.group',
          label: 'Group',
          disabled: !canGroup,
          onClick: () => {
            groupNodes(instance, nodeIds)
          }
        },
        {
          key: 'structure.ungroup',
          label: 'Ungroup',
          disabled: !canUngroup,
          onClick: () => {
            ungroupNodes(instance, groupIds)
          }
        }
      ]
    },
    state: {
      visible: canEdit,
      items: [
        {
          key: 'state.lock',
          label: readLockLabel(summary),
          disabled: !canEdit,
          onClick: () => {
            toggleNodesLock(instance, nodes, summary)
          }
        }
      ]
    },
    edit: {
      visible: canEdit,
      items: [
        ...(extras?.onCopy
          ? [
            {
              key: 'edit.copy',
              label: 'Copy',
              disabled: !canEdit,
              onClick: extras.onCopy
            }
          ]
          : []),
        ...(extras?.onCut
          ? [
            {
              key: 'edit.cut',
              label: 'Cut',
              disabled: !canEdit,
              onClick: extras.onCut
            }
          ]
          : []),
        {
          key: 'edit.duplicate',
          label: 'Duplicate',
          disabled: !canEdit,
          onClick: () => {
            duplicateNodes(instance, nodeIds)
          }
        }
      ]
    },
    danger: {
      visible: canEdit,
      items: [
        {
          key: 'danger.delete',
          label: 'Delete',
          tone: 'danger',
          disabled: !canEdit,
          onClick: () => {
            deleteNodes(instance, nodeIds)
          }
        }
      ]
    }
  }
}

export const buildMoreMenuSections = (
  actions: NodeSelectionActions
): NodeMenuSection[] => {
  const sections: NodeMenuSection[] = []

  if (actions.layer.visible) {
    sections.push({
      key: 'layer',
      title: 'Layer',
      items: actions.layer.items
    })
  }

  if (actions.structure.visible) {
    sections.push({
      key: 'structure',
      title: 'Structure',
      items: actions.structure.items
    })
  }

  if (actions.state.visible) {
    sections.push({
      key: 'state',
      title: 'State',
      items: actions.state.items
    })
  }

  if (actions.edit.visible) {
    sections.push({
      key: 'edit',
      title: 'Edit',
      items: actions.edit.items
    })
  }

  if (actions.danger.visible) {
    sections.push({
      key: 'danger',
      title: 'Danger',
      items: actions.danger.items
    })
  }

  return sections
}

export const buildContextMenuGroups = (
  actions: NodeSelectionActions
): NodeContextMenuGroup[] => {
  const groups: NodeContextMenuGroup[] = []

  if (actions.layout.visible) {
    groups.push({
      key: 'layout',
      items: [
        {
          key: 'layout.menu',
          label: 'Layout',
          children: [
            ...actions.layout.alignItems,
            ...actions.layout.distributeItems
          ]
        }
      ]
    })
  }

  if (actions.layer.visible) {
    groups.push({
      key: 'layer',
      items: [
        {
          key: 'layer.menu',
          label: 'Layer',
          children: actions.layer.items
        }
      ]
    })
  }

  if (actions.structure.visible) {
    groups.push({
      key: 'structure',
      items: actions.structure.items
    })
  }

  if (actions.state.visible) {
    groups.push({
      key: 'state',
      items: actions.state.items
    })
  }

  if (actions.edit.visible) {
    groups.push({
      key: 'edit',
      items: actions.edit.items
    })
  }

  if (actions.danger.visible) {
    groups.push({
      key: 'danger',
      items: actions.danger.items
    })
  }

  return groups
}
