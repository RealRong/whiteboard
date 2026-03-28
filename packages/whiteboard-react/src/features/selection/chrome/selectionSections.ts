import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node } from '@whiteboard/core/types'
import {
  readLockLabel,
  type NodeSelectionCan,
  type NodeSummary
} from '../../node/summary'
import {
  createSelectionOperations,
  runMenuAction,
  type SelectionMenuInstance,
  type SelectionOrderMode
} from './selectionMenuActions'
import type {
  SelectionLayoutActions,
  SelectionMenuGroup,
  SelectionMoreMenuItem,
  SelectionMoreMenuSection
} from './selectionMenuTypes'

const ORDER_ITEMS: ReadonlyArray<{
  key: string
  label: string
  mode: SelectionOrderMode
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

const readLayerItems = ({
  can,
  order,
  close
}: {
  can: NodeSelectionCan
  order: (mode: SelectionOrderMode) => unknown
  close?: () => void
}): SelectionMoreMenuItem[] => can.order
  ? ORDER_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      onClick: runMenuAction(() => order(item.mode), close)
    }))
  : []

const readLayoutItems = ({
  can,
  align,
  distribute,
  close
}: {
  can: NodeSelectionCan
  align: (mode: NodeAlignMode) => unknown
  distribute: (mode: NodeDistributeMode) => unknown
  close?: () => void
}): SelectionMoreMenuItem[] => (
  can.align
    ? [
        ...ALIGN_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.align,
          onClick: runMenuAction(() => align(item.mode), close)
        })),
        ...DISTRIBUTE_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.distribute,
          onClick: runMenuAction(() => distribute(item.mode), close)
        }))
      ]
    : []
)

export const resolveSelectionLayoutActions = ({
  instance,
  nodes,
  can,
  close
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  can: NodeSelectionCan
  close?: () => void
}): SelectionLayoutActions => {
  const operations = createSelectionOperations({
    instance,
    nodes
  })

  return {
    canAlign: can.align,
    canDistribute: can.distribute,
    onAlign: (mode) => runMenuAction(
      () => operations.align(mode),
      close
    )(),
    onDistribute: (mode) => runMenuAction(
      () => operations.distribute(mode),
      close
    )()
  }
}

export const resolveSelectionMoreMenuSections = ({
  instance,
  nodes,
  summary,
  can,
  close
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  summary: NodeSummary
  can: NodeSelectionCan
  close?: () => void
}): SelectionMoreMenuSection[] => {
  const operations = createSelectionOperations({
    instance,
    nodes
  })
  const layerItems = readLayerItems({
    can,
    order: operations.order,
    close
  })

  const sections: SelectionMoreMenuSection[] = []

  if (layerItems.length > 0) {
    sections.push({
      key: 'layer',
      title: 'Layer',
      items: layerItems
    })
  }

  sections.push({
    key: 'structure',
    title: 'Structure',
    items: [
      {
        key: 'structure.group',
        label: 'Group',
        disabled: !can.makeGroup,
        onClick: runMenuAction(operations.group, close)
      },
      {
        key: 'structure.ungroup',
        label: 'Ungroup',
        disabled: !can.ungroup,
        onClick: runMenuAction(operations.ungroup, close)
      }
    ]
  })

  if (can.lock) {
    sections.push({
      key: 'state',
      title: 'State',
      items: [
        {
          key: 'state.lock',
          label: readLockLabel(summary),
          onClick: runMenuAction(
            () => operations.lock(summary.lock !== 'all'),
            close
          )
        }
      ]
    })
  }

  sections.push({
    key: 'edit',
    title: 'Edit',
    items: [
      {
        key: 'edit.copy',
        label: 'Copy',
        disabled: !can.copy,
        onClick: runMenuAction(operations.copy, close)
      },
      {
        key: 'edit.cut',
        label: 'Cut',
        disabled: !can.cut,
        onClick: runMenuAction(operations.cut, close)
      },
      {
        key: 'edit.duplicate',
        label: 'Duplicate',
        disabled: !can.duplicate,
        onClick: runMenuAction(operations.duplicate, close)
      }
    ]
  })

  if (can.delete) {
    sections.push({
      key: 'danger',
      title: 'Danger',
      items: [
        {
          key: 'danger.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: runMenuAction(operations.delete, close)
        }
      ]
    })
  }

  return sections
}

export const resolveSelectionContextMenuGroups = ({
  instance,
  nodes,
  summary,
  can,
  close
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  summary: NodeSummary
  can: NodeSelectionCan
  close?: () => void
}): SelectionMenuGroup[] => {
  const operations = createSelectionOperations({
    instance,
    nodes
  })
  const groups: SelectionMenuGroup[] = []
  const layoutItems = readLayoutItems({
    can,
    align: operations.align,
    distribute: operations.distribute,
    close
  })
  const layerItems = readLayerItems({
    can,
    order: operations.order,
    close
  })

  if (layoutItems.length > 0) {
    groups.push({
      key: 'layout',
      items: [
        {
          key: 'layout.menu',
          label: 'Layout',
          children: layoutItems
        }
      ]
    })
  }

  if (layerItems.length > 0) {
    groups.push({
      key: 'layer',
      items: [
        {
          key: 'layer.menu',
          label: 'Layer',
          children: layerItems
        }
      ]
    })
  }

  groups.push({
    key: 'structure',
    title: 'Structure',
    items: [
      {
        key: 'structure.group',
        label: 'Group',
        disabled: !can.makeGroup,
        onClick: runMenuAction(operations.group, close)
      },
      {
        key: 'structure.ungroup',
        label: 'Ungroup',
        disabled: !can.ungroup,
        onClick: runMenuAction(operations.ungroup, close)
      }
    ]
  })

  if (can.lock) {
    groups.push({
      key: 'state',
      title: 'State',
      items: [
        {
          key: 'state.lock',
          label: readLockLabel(summary),
          onClick: runMenuAction(
            () => operations.lock(summary.lock !== 'all'),
            close
          )
        }
      ]
    })
  }

  groups.push({
    key: 'edit',
    title: 'Edit',
    items: [
      {
        key: 'edit.copy',
        label: 'Copy',
        disabled: !can.copy,
        onClick: runMenuAction(operations.copy, close)
      },
      {
        key: 'edit.cut',
        label: 'Cut',
        disabled: !can.cut,
        onClick: runMenuAction(operations.cut, close)
      },
      {
        key: 'edit.duplicate',
        label: 'Duplicate',
        disabled: !can.duplicate,
        onClick: runMenuAction(operations.duplicate, close)
      }
    ]
  })

  if (can.delete) {
    groups.push({
      key: 'danger',
      title: 'Danger',
      items: [
        {
          key: 'danger.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: runMenuAction(operations.delete, close)
        }
      ]
    })
  }

  return groups
}
