import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { InternalInstance } from '../../runtime/instance'
import type { NodeMeta } from '../../types/node'
import {
  resolveNodeSelectionCan,
  type NodeSelectionCan,
  type NodeTypeSummary,
  readLockLabel,
  summarizeNodes,
  type NodeSummary
} from './summary'

type NodeActionsInstance = Pick<InternalInstance, 'commands'>
type OrderMode = 'front' | 'forward' | 'backward' | 'back'

type NodeActionExtras = {
  onCopy?: () => unknown
  onCut?: () => unknown
  summary?: NodeSummary
  can?: NodeSelectionCan
  resolveMeta?: (node: Node) => NodeMeta | undefined
}

export type NodeActionItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => void
}

export type NodeActionSection = {
  key: 'layout' | 'layer' | 'structure' | 'state' | 'edit' | 'danger'
  title: string
  kind: 'submenu' | 'list'
  items: readonly NodeActionItem[]
}

export type NodeSelectionActions = {
  summary: NodeSummary
  can: NodeSelectionCan
  sections: readonly NodeActionSection[]
  filter?: {
    types: readonly NodeTypeSummary[]
    onSelect: (key: string) => void
  }
  layout: {
    canAlign: boolean
    canDistribute: boolean
    alignItems: readonly NodeActionItem[]
    distributeItems: readonly NodeActionItem[]
    onAlign: (mode: NodeAlignMode) => void
    onDistribute: (mode: NodeDistributeMode) => void
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

const readSections = ({
  layout,
  layerItems,
  structureItems,
  stateItems,
  editItems,
  dangerItems
}: {
  layout: NodeSelectionActions['layout']
  layerItems: readonly NodeActionItem[]
  structureItems: readonly NodeActionItem[]
  stateItems: readonly NodeActionItem[]
  editItems: readonly NodeActionItem[]
  dangerItems: readonly NodeActionItem[]
}): NodeActionSection[] => {
  const sections: NodeActionSection[] = []

  if (layout.canAlign) {
    sections.push({
      key: 'layout',
      title: 'Layout',
      kind: 'submenu',
      items: [
        ...layout.alignItems,
        ...layout.distributeItems
      ]
    })
  }

  if (layerItems.length > 0) {
    sections.push({
      key: 'layer',
      title: 'Layer',
      kind: 'submenu',
      items: layerItems
    })
  }

  if (structureItems.length > 0) {
    sections.push({
      key: 'structure',
      title: 'Structure',
      kind: 'list',
      items: structureItems
    })
  }

  if (stateItems.length > 0) {
    sections.push({
      key: 'state',
      title: 'State',
      kind: 'list',
      items: stateItems
    })
  }

  if (editItems.length > 0) {
    sections.push({
      key: 'edit',
      title: 'Edit',
      kind: 'list',
      items: editItems
    })
  }

  if (dangerItems.length > 0) {
    sections.push({
      key: 'danger',
      title: 'Danger',
      kind: 'list',
      items: dangerItems
    })
  }

  return sections
}

export const createNodeSelectionActions = (
  instance: NodeActionsInstance,
  nodes: readonly Node[],
  extras?: NodeActionExtras
): NodeSelectionActions => {
  const summary = extras?.summary ?? summarizeNodes(nodes, {
    resolveMeta: extras?.resolveMeta
  })
  const can = extras?.can ?? resolveNodeSelectionCan(nodes, {
    resolveMeta: extras?.resolveMeta
  })
  const nodeIds = summary.ids
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)

  const selection = {
    replace: (nextNodeIds: readonly NodeId[]) => {
      instance.commands.selection.replace({
        nodeIds: nextNodeIds
      })
    }
  }

  const run = {
    filter: (key: string) => {
      const filteredNodeIds = nodes
        .filter((node) => (extras?.resolveMeta?.(node)?.key ?? node.type) === key)
        .map((node) => node.id)

      if (!filteredNodeIds.length) {
        return
      }

      selection.replace(filteredNodeIds)
    },
    order: (mode: OrderMode) => {
      if (!nodeIds.length) {
        return
      }

      if (mode === 'front') {
        instance.commands.node.order.bringToFront([...nodeIds])
        return
      }
      if (mode === 'forward') {
        instance.commands.node.order.bringForward([...nodeIds])
        return
      }
      if (mode === 'backward') {
        instance.commands.node.order.sendBackward([...nodeIds])
        return
      }
      instance.commands.node.order.sendToBack([...nodeIds])
    },
    align: (mode: NodeAlignMode) => {
      if (nodeIds.length < 2) {
        return
      }

      instance.commands.node.align([...nodeIds], mode)
    },
    distribute: (mode: NodeDistributeMode) => {
      if (nodeIds.length < 3) {
        return
      }

      instance.commands.node.distribute([...nodeIds], mode)
    },
    group: () => {
      if (nodeIds.length < 2) {
        return
      }

      const result = instance.commands.node.group.create([...nodeIds])
      if (!result.ok) {
        return
      }

      selection.replace([result.data.groupId])
    },
    ungroup: () => {
      if (!groupIds.length) {
        return
      }

      const result = instance.commands.node.group.ungroupMany([...groupIds])
      if (!result.ok) {
        return
      }

      selection.replace(result.data.nodeIds)
    },
    lock: (locked: boolean) => {
      if (!nodes.length) {
        return
      }

      instance.commands.node.updateMany(nodes.map((node) => ({
        id: node.id,
        update: {
          fields: {
            locked
          }
        }
      })))
    },
    duplicate: () => {
      if (!nodeIds.length) {
        return
      }

      const result = instance.commands.node.duplicate([...nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return
      }

      selection.replace(result.data.nodeIds)
    },
    delete: () => {
      if (!nodeIds.length) {
        return
      }

      instance.commands.node.deleteCascade([...nodeIds])
    }
  }

  const layout: NodeSelectionActions['layout'] = {
    canAlign: can.align,
    canDistribute: can.distribute,
    alignItems: ALIGN_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      disabled: !can.align,
      onClick: () => {
        run.align(item.mode)
      }
    })),
    distributeItems: DISTRIBUTE_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      disabled: !can.distribute,
      onClick: () => {
        run.distribute(item.mode)
      }
    })),
    onAlign: run.align,
    onDistribute: run.distribute
  }

  const layerItems: NodeActionItem[] = can.order
    ? ORDER_ITEMS.map((item) => ({
        key: item.key,
        label: item.label,
        disabled: false,
        onClick: () => {
          run.order(item.mode)
        }
      }))
    : []

  const structureItems: NodeActionItem[] = [
    {
      key: 'structure.group',
      label: 'Group',
      disabled: !can.makeGroup,
      onClick: run.group
    },
    {
      key: 'structure.ungroup',
      label: 'Ungroup',
      disabled: !can.ungroup,
      onClick: run.ungroup
    }
  ]

  const stateItems: NodeActionItem[] = can.lock
    ? [
        {
          key: 'state.lock',
          label: readLockLabel(summary),
          disabled: false,
          onClick: () => {
            run.lock(summary.lock !== 'all')
          }
        }
      ]
    : []

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
      onClick: run.duplicate
    }
  ]

  const dangerItems: NodeActionItem[] = can.delete
    ? [
        {
          key: 'danger.delete',
          label: 'Delete',
          tone: 'danger',
          disabled: false,
          onClick: run.delete
        }
      ]
    : []

  return {
    summary,
    can,
    filter: can.filter
      ? {
          types: summary.types,
          onSelect: run.filter
        }
      : undefined,
    layout,
    sections: readSections({
      layout,
      layerItems,
      structureItems,
      stateItems,
      editItems,
      dangerItems
    })
  }
}
