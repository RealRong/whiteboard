import {
  createDerivedStore,
  type ReadStore
} from '@whiteboard/engine'
import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type {
  Node,
  NodeId
} from '@whiteboard/core/types'
import type { Editor } from '../editor/types'
import type { NodeRegistry } from '../../types/node'
import type { SelectionSnapshot } from '../selection'
import {
  readContextLockLabel,
  resolveContextNodeMeta,
  resolveContextSelectionCan,
  summarizeContextNodes
} from './summary'
import type {
  SelectionCan,
  SelectionLayoutView,
  SelectionMenuFilterView,
  SelectionMenuGroupView,
  SelectionMenuItemView,
  SelectionMenuView,
  SelectionMoreMenuItemView,
  SelectionMoreMenuSectionView
} from './types'

type SelectionMenuHost = {
  commands: () => Editor['commands']
  registry: Pick<NodeRegistry, 'get'>
}
type SelectionOrderMode = 'front' | 'forward' | 'backward' | 'back'

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

const bindAction = (
  action: (() => unknown) | undefined,
  close?: () => void
) => {
  if (!action) {
    return undefined
  }
  if (!close) {
    return action
  }

  return () => {
    const result = action()

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result).finally(close)
    }

    close()
    return result
  }
}

const bindActionWithArgs = <Args extends unknown[]>(
  action: (...args: Args) => unknown,
  close?: () => void
) => {
  if (!close) {
    return action
  }

  return (...args: Args) => {
    const result = action(...args)

    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      return Promise.resolve(result).finally(close)
    }

    close()
    return result
  }
}

const readFilteredNodeIds = (
  nodes: readonly Node[],
  key: string,
  resolveMeta: (node: Node) => { key?: string }
) => nodes
  .filter((node) => (resolveMeta(node).key ?? node.type) === key)
  .map((node) => node.id)

const createSelectionOperations = ({
  editor,
  nodes
}: {
  editor: SelectionMenuHost
  nodes: readonly Node[]
}) => {
  const nodeIds = nodes.map((node) => node.id)
  const groupIds = nodes
    .filter((node) => node.type === 'group')
    .map((node) => node.id)
  const replaceSelection = (nextNodeIds: readonly NodeId[]) => {
    editor.commands().selection.replace({
      nodeIds: nextNodeIds
    })
  }

  return {
    filter: (key: string) => {
      const filteredNodeIds = readFilteredNodeIds(
        nodes,
        key,
        (node) => resolveContextNodeMeta(editor.registry, node)
      )
      if (!filteredNodeIds.length) {
        return
      }

      replaceSelection(filteredNodeIds)
    },
    order: (mode: SelectionOrderMode) => {
      if (!nodeIds.length) {
        return
      }

      if (mode === 'front') {
        editor.commands().node.order.bringToFront([...nodeIds])
        return
      }
      if (mode === 'forward') {
        editor.commands().node.order.bringForward([...nodeIds])
        return
      }
      if (mode === 'backward') {
        editor.commands().node.order.sendBackward([...nodeIds])
        return
      }

      editor.commands().node.order.sendToBack([...nodeIds])
    },
    align: (mode: NodeAlignMode) => {
      if (nodeIds.length < 2) {
        return
      }

      editor.commands().node.align([...nodeIds], mode)
    },
    distribute: (mode: NodeDistributeMode) => {
      if (nodeIds.length < 3) {
        return
      }

      editor.commands().node.distribute([...nodeIds], mode)
    },
    group: () => {
      if (nodeIds.length < 2) {
        return
      }

      const result = editor.commands().node.group.create([...nodeIds])
      if (!result.ok) {
        return
      }

      replaceSelection([result.data.groupId])
    },
    ungroup: () => {
      if (!groupIds.length) {
        return
      }

      const result = editor.commands().node.group.ungroupMany([...groupIds])
      if (!result.ok) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    lock: (locked: boolean) => {
      if (!nodeIds.length) {
        return
      }

      editor.commands().node.lock.set([...nodeIds], locked)
    },
    copy: () => {
      if (!nodeIds.length) {
        return
      }

      return editor.commands().clipboard.copy({
        nodeIds
      })
    },
    cut: () => {
      if (!nodeIds.length) {
        return
      }

      return editor.commands().clipboard.cut({
        nodeIds
      })
    },
    duplicate: () => {
      if (!nodeIds.length) {
        return
      }

      const result = editor.commands().node.duplicate([...nodeIds])
      if (!result.ok || result.data.nodeIds.length <= 0) {
        return
      }

      replaceSelection(result.data.nodeIds)
    },
    delete: () => {
      if (!nodeIds.length) {
        return
      }

      editor.commands().node.deleteCascade([...nodeIds])
    }
  }
}

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
  summary: ReturnType<typeof summarizeContextNodes>
  operations: ReturnType<typeof createSelectionOperations>
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
  summary: ReturnType<typeof summarizeContextNodes>
  operations: ReturnType<typeof createSelectionOperations>
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

export const createSelectionMenuRead = ({
  editor,
  selection
}: {
  editor: SelectionMenuHost
  selection: ReadStore<SelectionSnapshot>
}): ReadStore<SelectionMenuView | null> => createDerivedStore({
  get: (read) => readSelectionMenuView({
    editor,
    nodes: read(selection).items.nodes
  }) ?? null
})
