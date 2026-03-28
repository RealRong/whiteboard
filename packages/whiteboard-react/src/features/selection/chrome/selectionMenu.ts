import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type { Node, NodeId } from '@whiteboard/core/types'
import type { InternalEditor } from '../../../runtime/instance/types'
import type { NodeMeta } from '../../../types/node'
import {
  readLockLabel,
  type NodeSelectionCan,
  type NodeSummary,
  type NodeTypeSummary
} from '../../node/summary'

type SelectionMenuInstance = Pick<InternalEditor, 'commands'>
type NodeMetaResolver = (node: Node) => NodeMeta | undefined

type OrderMode = 'front' | 'forward' | 'backward' | 'back'

export type SelectionMenuItem = {
  key: string
  label: string
  tone?: 'danger'
  disabled?: boolean
  onClick?: () => unknown
  children?: readonly SelectionMenuItem[]
}

export type SelectionMenuGroup = {
  key: string
  title?: string
  items: readonly SelectionMenuItem[]
}

export type SelectionMenuFilter = {
  types: readonly NodeTypeSummary[]
  onSelect: (key: string) => unknown
}

type SelectionActionMenuItem = {
  key: string
  label: string
  disabled?: boolean
  tone?: 'danger'
  onClick: () => unknown
}

export type SelectionMoreMenuItem = SelectionActionMenuItem

export type SelectionMoreMenuSection = {
  key: string
  title: string
  items: readonly SelectionMoreMenuItem[]
}

export type SelectionLayoutActions = {
  canAlign: boolean
  canDistribute: boolean
  onAlign: (mode: NodeAlignMode) => unknown
  onDistribute: (mode: NodeDistributeMode) => unknown
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

export const runMenuAction = (
  action: () => unknown,
  close?: () => void
) => () => {
  const result = action()

  if (!close) {
    return result
  }

  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    return Promise.resolve(result).finally(close)
  }

  close()
  return result
}

const readFilteredNodeIds = (
  nodes: readonly Node[],
  resolveMeta: NodeMetaResolver | undefined,
  key: string
) => nodes
  .filter((node) => (resolveMeta?.(node)?.key ?? node.type) === key)
  .map((node) => node.id)

const createSelectionOperations = ({
  instance,
  nodes,
  resolveMeta
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  resolveMeta?: NodeMetaResolver
}) => {
  const nodeIds = nodes.map((node) => node.id)
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)

  const replaceSelection = (nextNodeIds: readonly NodeId[]) => {
    instance.commands.selection.replace({
      nodeIds: nextNodeIds
    })
  }

  return {
    nodeIds,
    replaceSelection,
    filter: (key: string) => {
      const filteredNodeIds = readFilteredNodeIds(nodes, resolveMeta, key)
      if (!filteredNodeIds.length) {
        return
      }
      replaceSelection(filteredNodeIds)
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

      replaceSelection([result.data.groupId])
    },
    ungroup: () => {
      if (!groupIds.length) {
        return
      }

      const result = instance.commands.node.group.ungroupMany([...groupIds])
      if (!result.ok) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    lock: (locked: boolean) => {
      if (!nodeIds.length) {
        return
      }

      instance.commands.node.lock.set([...nodeIds], locked)
    },
    copy: () => {
      if (!nodeIds.length) {
        return
      }

      return instance.commands.clipboard.copy({
        nodeIds
      })
    },
    cut: () => {
      if (!nodeIds.length) {
        return
      }

      return instance.commands.clipboard.cut({
        nodeIds
      })
    },
    duplicate: () => {
      if (!nodeIds.length) {
        return
      }

      const result = instance.commands.node.duplicate([...nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    delete: () => {
      if (!nodeIds.length) {
        return
      }

      instance.commands.node.deleteCascade([...nodeIds])
    }
  }
}

const readLayerItems = ({
  can,
  order,
  close
}: {
  can: NodeSelectionCan
  order: (mode: OrderMode) => unknown
  close?: () => void
}): SelectionActionMenuItem[] => can.order
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
}): SelectionActionMenuItem[] => (
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

export const resolveSelectionFilter = ({
  instance,
  nodes,
  summary,
  can,
  resolveMeta,
  close
}: {
  instance: SelectionMenuInstance
  nodes: readonly Node[]
  summary: NodeSummary
  can: NodeSelectionCan
  resolveMeta?: NodeMetaResolver
  close?: () => void
}): SelectionMenuFilter | undefined => {
  if (!can.filter) {
    return undefined
  }

  const operations = createSelectionOperations({
    instance,
    nodes,
    resolveMeta
  })

  return {
    types: summary.types,
    onSelect: (key) => runMenuAction(
      () => operations.filter(key),
      close
    )()
  }
}

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
