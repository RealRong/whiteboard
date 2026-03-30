import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node } from '@whiteboard/core/types'
import {
  readContextLockLabel,
  resolveContextNodeMeta,
  resolveContextSelectionCan,
  summarizeContextNodes
} from './summary'
import {
  bindAction,
  bindActionWithArgs,
  createSelectionOperations,
  type SelectionMenuHost,
  type SelectionMenuOperations,
  type SelectionOrderMode
} from './actions'
import type {
  SelectionCan,
  SelectionLayoutView,
  SelectionMenuFilterView,
  SelectionMenuGroupView,
  SelectionMenuItemView,
  SelectionMenuView,
  SelectionMoreMenuItemView,
  SelectionMoreMenuSectionView,
  SelectionNodeSummary
} from '../../../types/public/context'

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
] as const

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
] as const

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
] as const

const readLayerGroupItems = ({
  can,
  order,
  close
}: {
  can: SelectionCan
  order: (mode: SelectionOrderMode) => unknown
  close?: () => void
}): SelectionMenuItemView[] => can.order
  ? ORDER_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      onSelect: bindAction(() => order(item.mode), close)
    }))
  : []

const readLayoutGroupItems = ({
  can,
  align,
  distribute,
  close
}: {
  can: SelectionCan
  align: (mode: NodeAlignMode) => unknown
  distribute: (mode: NodeDistributeMode) => unknown
  close?: () => void
}): SelectionMenuItemView[] => (
  can.align
    ? [
        ...ALIGN_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.align,
          onSelect: bindAction(() => align(item.mode), close)
        })),
        ...DISTRIBUTE_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.distribute,
          onSelect: bindAction(() => distribute(item.mode), close)
        }))
      ]
    : []
)

const readMoreLayerItems = ({
  can,
  order,
  close
}: {
  can: SelectionCan
  order: (mode: SelectionOrderMode) => unknown
  close?: () => void
}): SelectionMoreMenuItemView[] => can.order
  ? ORDER_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      onSelect: bindAction(() => order(item.mode), close) ?? (() => undefined)
    }))
  : []

const readSelectionGroups = ({
  can,
  summary,
  operations,
  close
}: {
  can: SelectionCan
  summary: SelectionNodeSummary
  operations: SelectionMenuOperations
  close?: () => void
}): SelectionMenuGroupView[] => {
  const groups: SelectionMenuGroupView[] = []
  const layoutItems = readLayoutGroupItems({
    can,
    align: operations.align,
    distribute: operations.distribute,
    close
  })
  const layerItems = readLayerGroupItems({
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
        onSelect: bindAction(operations.group, close)
      },
      {
        key: 'structure.ungroup',
        label: 'Ungroup',
        disabled: !can.ungroup,
        onSelect: bindAction(operations.ungroup, close)
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
          label: readContextLockLabel(summary),
          onSelect: bindAction(
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
        onSelect: bindAction(operations.copy, close)
      },
      {
        key: 'edit.cut',
        label: 'Cut',
        disabled: !can.cut,
        onSelect: bindAction(operations.cut, close)
      },
      {
        key: 'edit.duplicate',
        label: 'Duplicate',
        disabled: !can.duplicate,
        onSelect: bindAction(operations.duplicate, close)
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
          onSelect: bindAction(operations.delete, close)
        }
      ]
    })
  }

  return groups
}

const readSelectionMoreSections = ({
  can,
  summary,
  operations,
  close
}: {
  can: SelectionCan
  summary: SelectionNodeSummary
  operations: SelectionMenuOperations
  close?: () => void
}): SelectionMoreMenuSectionView[] => {
  const sections: SelectionMoreMenuSectionView[] = []
  const layerItems = readMoreLayerItems({
    can,
    order: operations.order,
    close
  })

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
        onSelect: bindAction(operations.group, close) ?? (() => undefined)
      },
      {
        key: 'structure.ungroup',
        label: 'Ungroup',
        disabled: !can.ungroup,
        onSelect: bindAction(operations.ungroup, close) ?? (() => undefined)
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
          label: readContextLockLabel(summary),
          onSelect: bindAction(
            () => operations.lock(summary.lock !== 'all'),
            close
          ) ?? (() => undefined)
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
        onSelect: bindAction(operations.copy, close) ?? (() => undefined)
      },
      {
        key: 'edit.cut',
        label: 'Cut',
        disabled: !can.cut,
        onSelect: bindAction(operations.cut, close) ?? (() => undefined)
      },
      {
        key: 'edit.duplicate',
        label: 'Duplicate',
        disabled: !can.duplicate,
        onSelect: bindAction(operations.duplicate, close) ?? (() => undefined)
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
          onSelect: bindAction(operations.delete, close) ?? (() => undefined)
        }
      ]
    })
  }

  return sections
}

export const readSelectionMenuView = ({
  editor,
  nodes,
  close
}: {
  editor: SelectionMenuHost
  nodes: readonly Node[]
  close?: () => void
}): SelectionMenuView | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const resolveMeta = (node: Node) => resolveContextNodeMeta(editor.registry, node)
  const summary = summarizeContextNodes({
    nodes,
    resolveMeta
  })
  const can = resolveContextSelectionCan({
    nodes,
    resolveMeta
  })
  const operations = createSelectionOperations({
    editor,
    nodes
  })
  const filter = can.filter
    ? {
        types: summary.types,
        onSelect: bindActionWithArgs(operations.filter, close)
      } satisfies SelectionMenuFilterView
    : undefined

  return {
    summary,
    can,
    filter,
    groups: readSelectionGroups({
      can,
      summary,
      operations,
      close
    }),
    moreSections: readSelectionMoreSections({
      can,
      summary,
      operations,
      close
    }),
    layout: {
      canAlign: can.align,
      canDistribute: can.distribute,
      onAlign: bindActionWithArgs(operations.align, close),
      onDistribute: bindActionWithArgs(operations.distribute, close)
    } satisfies SelectionLayoutView
  }
}
