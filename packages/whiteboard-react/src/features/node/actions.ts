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
  filterNodesByType,
  groupNodes,
  orderNodes,
  toggleNodesLock,
  ungroupNodes,
  type OrderMode
} from './commands'
import {
  resolveNodeSelectionCan,
  type NodeSelectionCan,
  type NodeTypeSummary,
  readLockLabel,
  summarizeNodes,
  type NodeSummary
} from './summary'

type NodeActionsInstance = Pick<WhiteboardInstance, 'commands' | 'registry'>

type NodeActionExtras = {
  onCopy?: () => unknown
  onCut?: () => unknown
  summary?: NodeSummary
  can?: NodeSelectionCan
}

export type NodeActionItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
}

export type NodeSelectionActions = {
  summary: NodeSummary
  can: NodeSelectionCan
  filter: {
    visible: boolean
    types: readonly NodeTypeSummary[]
    onSelect: (type: string) => void
  }
  layer: {
    visible: boolean
    items: readonly NodeActionItem[]
    onSelect: (mode: OrderMode) => void
  }
  layout: {
    visible: boolean
    canAlign: boolean
    canDistribute: boolean
    alignItems: readonly NodeActionItem[]
    distributeItems: readonly NodeActionItem[]
    onAlign: (mode: NodeAlignMode) => void
    onDistribute: (mode: NodeDistributeMode) => void
  }
  structure: {
    visible: boolean
    items: readonly NodeActionItem[]
  }
  state: {
    visible: boolean
    items: readonly NodeActionItem[]
  }
  edit: {
    visible: boolean
    items: readonly NodeActionItem[]
  }
  danger: {
    visible: boolean
    items: readonly NodeActionItem[]
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
  const summary = extras?.summary ?? summarizeNodes(nodes)
  const can = extras?.can ?? resolveNodeSelectionCan(nodes, {
    resolveMeta: (type) => instance.registry.get(type)?.meta
  })
  const nodeIds = summary.ids
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)

  const onOrder = (mode: OrderMode) => {
    orderNodes(instance, nodeIds, mode)
  }

  const onAlign = (mode: NodeAlignMode) => {
    alignNodes(instance, nodeIds, mode)
  }

  const onDistribute = (mode: NodeDistributeMode) => {
    distributeNodes(instance, nodeIds, mode)
  }

  const structureItems: NodeActionItem[] = [
    {
      key: 'structure.group',
      label: 'Group',
      disabled: !can.makeGroup,
      onClick: () => {
        groupNodes(instance, nodeIds)
      }
    },
    {
      key: 'structure.ungroup',
      label: 'Ungroup',
      disabled: !can.ungroup,
      onClick: () => {
        ungroupNodes(instance, groupIds)
      }
    }
  ]

  const stateItems: NodeActionItem[] = [
    {
      key: 'state.lock',
      label: readLockLabel(summary),
      disabled: !can.lock,
      onClick: () => {
        toggleNodesLock(instance, nodes, summary)
      }
    }
  ]

  const editItems: NodeActionItem[] = [
    ...(extras?.onCopy
      ? [{
          key: 'edit.copy',
          label: 'Copy',
          disabled: !can.copy,
          onClick: extras.onCopy
        }]
      : []),
    ...(extras?.onCut
      ? [{
          key: 'edit.cut',
          label: 'Cut',
          disabled: !can.cut,
          onClick: extras.onCut
        }]
      : []),
    {
      key: 'edit.duplicate',
      label: 'Duplicate',
      disabled: !can.duplicate,
      onClick: () => {
        duplicateNodes(instance, nodeIds)
      }
    }
  ]

  const dangerItems: NodeActionItem[] = [
    {
      key: 'danger.delete',
      label: 'Delete',
      tone: 'danger',
      disabled: !can.delete,
      onClick: () => {
        deleteNodes(instance, nodeIds)
      }
    }
  ]

  return {
    summary,
    can,
    filter: {
      visible: can.filter,
      types: summary.types,
      onSelect: (type) => {
        filterNodesByType(instance, nodes, type)
      }
    },
    layer: {
      visible: can.order,
      items: ORDER_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !can.order,
        onClick: () => {
          onOrder(item.mode)
        }
      })),
      onSelect: onOrder
    },
    layout: {
      visible: can.align,
      canAlign: can.align,
      canDistribute: can.distribute,
      alignItems: ALIGN_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !can.align,
        onClick: () => {
          onAlign(item.mode)
        }
      })),
      distributeItems: DISTRIBUTE_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: !can.distribute,
        onClick: () => {
          onDistribute(item.mode)
        }
      })),
      onAlign,
      onDistribute
    },
    structure: {
      visible: can.makeGroup || can.ungroup,
      items: structureItems
    },
    state: {
      visible: can.lock,
      items: stateItems
    },
    edit: {
      visible: editItems.length > 0,
      items: editItems
    },
    danger: {
      visible: can.delete,
      items: dangerItems
    }
  }
}
