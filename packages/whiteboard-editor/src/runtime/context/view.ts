import type {
  NodeAlignMode,
  NodeDistributeMode
} from '@whiteboard/core/node'
import type {
  EdgeId,
  Node,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import { CREATE_PRESETS } from '../../features/toolbox/presets'
import type { InternalEditor } from '../instance/types'
import type { ContextResolved } from '../input/target'
import {
  readContextLockLabel,
  resolveContextNodeMeta,
  resolveContextSelectionCan,
  summarizeContextNodes
} from './summary'
import type {
  ContextMenuFilterView,
  ContextMenuGroupView,
  ContextMenuItemView,
  ContextMenuView
} from './types'

type ContextMenuHost = Pick<InternalEditor, 'commands' | 'host' | 'read'>
type SelectionOrderMode = 'front' | 'forward' | 'backward' | 'back'
type ContextSelectionCapabilities = ReturnType<typeof resolveContextSelectionCan>
type ContextNodeSummaryValue = ReturnType<typeof summarizeContextNodes>

const COLOR_OPTIONS = [
  { label: 'Ink', value: 'hsl(var(--ui-text-primary, 40 2.1% 28%))' },
  { label: 'White', value: 'hsl(var(--ui-surface, 0 0% 100%))' },
  { label: 'Gray', value: 'hsl(var(--ui-surface-muted, 40 9.1% 93.5%))' },
  { label: 'Yellow', value: 'hsl(var(--tag-yellow-background, 47.6 70.7% 92%))' },
  { label: 'Red', value: 'hsl(var(--tag-red-background, 5.7 77.8% 94.7%))' },
  { label: 'Blue', value: 'hsl(var(--tag-blue-background, 206.1 79.3% 94.3%))' },
  { label: 'Green', value: 'hsl(var(--tag-green-background, 146.7 24.3% 92.7%))' },
  { label: 'Purple', value: 'hsl(var(--tag-purple-background, 274.3 53.8% 94.9%))' },
  { label: 'Pink', value: 'hsl(var(--tag-pink-background, 331.8 63% 94.7%))' },
  { label: 'Slate', value: 'hsl(var(--ui-text-secondary, 37.5 3.3% 47.5%))' },
  { label: 'Danger', value: 'hsl(var(--ui-danger, 4 58.4% 54.7%))' },
  { label: 'Orange', value: 'hsl(var(--tag-orange-foreground, 28.4 64.7% 50%))' },
  { label: 'Forest', value: 'hsl(var(--tag-green-foreground, 146.5 29.8% 44.7%))' },
  { label: 'Accent', value: 'hsl(var(--ui-accent, 209.8 76.7% 51.2%))' },
  { label: 'Violet', value: 'hsl(var(--tag-purple-foreground, 278.6 32.7% 56.3%))' }
] as const

const STROKE_WIDTHS = [1, 2, 4, 6, 8, 12] as const
const DRAW_STROKE_WIDTHS = [2, 4, 8, 12] as const
const OPACITY_OPTIONS = [
  { label: '100%', value: 1 },
  { label: '70%', value: 0.7 },
  { label: '50%', value: 0.5 },
  { label: '35%', value: 0.35 }
] as const

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

const hasStyleField = (
  schema: NodeSchema | undefined,
  path: string
) => schema?.fields.some((field) => field.scope === 'style' && field.path === path) ?? false

const canEditStrokeStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'stroke')
  || hasStyleField(schema, 'strokeWidth')
  || typeof node.style?.stroke === 'string'
  || typeof node.style?.strokeWidth === 'number'
)

const canEditOpacityStyle = (
  node: Node,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'opacity')
  || typeof node.style?.opacity === 'number'
)

const withCurrentLabel = (
  label: string,
  active: boolean
) => active ? `${label} (Current)` : label

const runMenuAction = (
  action: () => unknown,
  close: () => void
) => () => {
  const result = action()

  if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
    return Promise.resolve(result).finally(close)
  }

  close()
  return result
}

const readFilteredNodeIds = (
  nodes: readonly Node[],
  key: string,
  resolveMeta: (node: Node) => { key?: string }
) => nodes
  .filter((node) => (resolveMeta(node).key ?? node.type) === key)
  .map((node) => node.id)

const createSelectionOperations = ({
  instance,
  nodes
}: {
  instance: ContextMenuHost
  nodes: readonly Node[]
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
    filter: (key: string) => {
      const filteredNodeIds = readFilteredNodeIds(
        nodes,
        key,
        (node) => resolveContextNodeMeta(instance.host.registry, node)
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
  can: ContextSelectionCapabilities
  order: (mode: SelectionOrderMode) => unknown
  close: () => void
}): ContextMenuItemView[] => can.order
  ? ORDER_ITEMS.map((item) => ({
      key: item.key,
      label: item.label,
      onSelect: runMenuAction(() => order(item.mode), close)
    }))
  : []

const readLayoutItems = ({
  can,
  align,
  distribute,
  close
}: {
  can: ContextSelectionCapabilities
  align: (mode: NodeAlignMode) => unknown
  distribute: (mode: NodeDistributeMode) => unknown
  close: () => void
}): ContextMenuItemView[] => (
  can.align
    ? [
        ...ALIGN_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.align,
          onSelect: runMenuAction(() => align(item.mode), close)
        })),
        ...DISTRIBUTE_ITEMS.map((item) => ({
          key: item.key,
          label: item.label,
          disabled: !can.distribute,
          onSelect: runMenuAction(() => distribute(item.mode), close)
        }))
      ]
    : []
)

const buildSelectionStyleGroup = ({
  instance,
  nodes,
  close
}: {
  instance: ContextMenuHost
  nodes: readonly Node[]
  close: () => void
}): ContextMenuGroupView | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: instance.host.registry.get(node.type)?.schema
  }))
  const supportsStroke = sources.every(({ node, schema }) => canEditStrokeStyle(node, schema))
  if (!supportsStroke) {
    return undefined
  }

  const supportsOpacity = sources.every(({ node, schema }) => canEditOpacityStyle(node, schema))
  const strokeWidths = nodes.every((node) => node.type === 'draw')
    ? DRAW_STROKE_WIDTHS
    : STROKE_WIDTHS
  const primary = nodes[0]
  const stroke = typeof primary.style?.stroke === 'string'
    ? primary.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidth = typeof primary.style?.strokeWidth === 'number'
    ? primary.style.strokeWidth
    : 1
  const opacity = typeof primary.style?.opacity === 'number'
    ? primary.style.opacity
    : 1
  const nodeIds = nodes.map((node) => node.id)
  const bindChild = (
    item: Omit<ContextMenuItemView, 'onSelect'> & {
      onSelect?: () => unknown
    }
  ): ContextMenuItemView => ({
    ...item,
    onSelect: item.onSelect
      ? runMenuAction(item.onSelect, close)
      : undefined
  })

  return {
    key: 'style',
    title: 'Style',
    items: [
      {
        key: 'style.stroke',
        label: 'Stroke',
        children: COLOR_OPTIONS.map((option) => bindChild({
          key: `style.stroke.${option.label.toLowerCase()}`,
          label: withCurrentLabel(option.label, stroke === option.value),
          onSelect: () => {
            instance.commands.node.appearance.setStroke(nodeIds, option.value)
          }
        }))
      },
      {
        key: 'style.width',
        label: 'Width',
        children: strokeWidths.map((value) => bindChild({
          key: `style.width.${value}`,
          label: withCurrentLabel(`${value}`, strokeWidth === value),
          onSelect: () => {
            instance.commands.node.appearance.setStrokeWidth(nodeIds, value)
          }
        }))
      },
      ...(supportsOpacity
        ? [
            {
              key: 'style.opacity',
              label: 'Opacity',
              children: OPACITY_OPTIONS.map((option) => bindChild({
                key: `style.opacity.${option.label}`,
                label: withCurrentLabel(option.label, opacity === option.value),
                onSelect: () => {
                  instance.commands.node.appearance.setOpacity(nodeIds, option.value)
                }
              }))
            }
          ]
        : [])
    ]
  }
}

const resolveSelectionFilter = ({
  instance,
  nodes,
  summary,
  can,
  close
}: {
  instance: ContextMenuHost
  nodes: readonly Node[]
  summary: ContextNodeSummaryValue
  can: ContextSelectionCapabilities
  close: () => void
}): ContextMenuFilterView | undefined => {
  if (!can.filter) {
    return undefined
  }

  const operations = createSelectionOperations({
    instance,
    nodes
  })

  return {
    types: summary.types,
    onSelect: (key) => runMenuAction(
      () => operations.filter(key),
      close
    )()
  }
}

const resolveSelectionContextMenuGroups = ({
  instance,
  nodes,
  summary,
  can,
  close
}: {
  instance: ContextMenuHost
  nodes: readonly Node[]
  summary: ContextNodeSummaryValue
  can: ContextSelectionCapabilities
  close: () => void
}): ContextMenuGroupView[] => {
  const operations = createSelectionOperations({
    instance,
    nodes
  })
  const groups: ContextMenuGroupView[] = []
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
        onSelect: runMenuAction(operations.group, close)
      },
      {
        key: 'structure.ungroup',
        label: 'Ungroup',
        disabled: !can.ungroup,
        onSelect: runMenuAction(operations.ungroup, close)
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
          onSelect: runMenuAction(
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
        onSelect: runMenuAction(operations.copy, close)
      },
      {
        key: 'edit.cut',
        label: 'Cut',
        disabled: !can.cut,
        onSelect: runMenuAction(operations.cut, close)
      },
      {
        key: 'edit.duplicate',
        label: 'Duplicate',
        disabled: !can.duplicate,
        onSelect: runMenuAction(operations.duplicate, close)
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
          onSelect: runMenuAction(operations.delete, close)
        }
      ]
    })
  }

  return groups
}

const readCanvasMenuView = ({
  instance,
  screen,
  world,
  close
}: {
  instance: ContextMenuHost
  screen: Point
  world: Point
  close: () => void
}): ContextMenuView => {
  const frame = instance.read.frame.scope.get()

  return {
    screen,
    groups: [
      {
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.paste',
            label: 'Paste',
            onSelect: runMenuAction(() => instance.commands.clipboard.paste({
              at: world,
              ownerId: frame.id
            }), close)
          }
        ]
      },
      {
        key: 'create',
        title: 'Create',
        items: CREATE_PRESETS.map((preset) => ({
          key: preset.key,
          label: preset.label,
          onSelect: runMenuAction(() => instance.commands.insert.preset(preset.key, {
            at: world,
            ownerId: frame.id
          }), close)
        }))
      },
      {
        key: 'history',
        title: 'History',
        items: [
          {
            key: 'history.undo',
            label: 'Undo',
            onSelect: runMenuAction(() => instance.commands.history.undo(), close)
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onSelect: runMenuAction(() => instance.commands.history.redo(), close)
          }
        ]
      },
      {
        key: 'selection',
        title: 'Selection',
        items: [
          {
            key: 'selection.select-all',
            label: 'Select all',
            onSelect: runMenuAction(() => instance.commands.selection.selectAll(), close)
          }
        ]
      }
    ]
  }
}

const readNodeMenuView = ({
  instance,
  screen,
  nodes,
  close
}: {
  instance: ContextMenuHost
  screen: Point
  nodes: readonly Node[]
  close: () => void
}): ContextMenuView => {
  const resolveMeta = (node: Node) => resolveContextNodeMeta(instance.host.registry, node)
  const summary = summarizeContextNodes({
    nodes,
    resolveMeta
  })
  const can = resolveContextSelectionCan({
    nodes,
    resolveMeta
  })
  const styleGroup = buildSelectionStyleGroup({
    instance,
    nodes,
    close
  })

  return {
    screen,
    summary: nodes.length > 1 ? summary : undefined,
    filter: resolveSelectionFilter({
      instance,
      nodes,
      summary,
      can,
      close
    }),
    groups: [
      ...(styleGroup ? [styleGroup] : []),
      ...resolveSelectionContextMenuGroups({
        instance,
        nodes,
        summary,
        can,
        close
      })
    ]
  }
}

const readEdgeMenuView = ({
  instance,
  screen,
  edgeId,
  close
}: {
  instance: ContextMenuHost
  screen: Point
  edgeId: EdgeId
  close: () => void
}): ContextMenuView => ({
  screen,
  groups: [
    {
      key: 'edge.actions',
      items: [
        {
          key: 'edge.copy',
          label: 'Copy',
          onSelect: runMenuAction(() => instance.commands.clipboard.copy({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onSelect: runMenuAction(() => instance.commands.clipboard.cut({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onSelect: runMenuAction(() => instance.commands.edge.delete([edgeId]), close)
        }
      ]
    }
  ]
})

export const readContextMenuView = ({
  instance,
  target,
  screen,
  close
}: {
  instance: ContextMenuHost
  target: ContextResolved | undefined
  screen: Point
  close: () => void
}): ContextMenuView | undefined => {
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'canvas':
      return readCanvasMenuView({
        instance,
        screen,
        world: target.world,
        close
      })
    case 'node':
      return readNodeMenuView({
        instance,
        screen,
        nodes: [target.node],
        close
      })
    case 'nodes':
      return readNodeMenuView({
        instance,
        screen,
        nodes: target.nodes,
        close
      })
    case 'edge':
      return readEdgeMenuView({
        instance,
        screen,
        edgeId: target.edgeId,
        close
      })
  }
}
