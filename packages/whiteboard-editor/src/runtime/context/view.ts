import type {
  EdgeId,
  Node,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import { CREATE_PRESETS } from '../../features/toolbox/presets'
import type { Editor } from '../editor/types'
import type { NodeRegistry } from '../../types/node'
import type { ContextResolved } from '../input/target'
import { readSelectionMenuView } from './selection'
import type {
  ContextMenuGroupView,
  ContextMenuItemView,
  ContextMenuView
} from './types'

type ContextMenuHost = Pick<Editor, 'commands' | 'read'> & {
  registry: Pick<NodeRegistry, 'get'>
}

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

const buildSelectionStyleGroup = ({
  editor,
  nodes,
  close
}: {
  editor: ContextMenuHost
  nodes: readonly Node[]
  close: () => void
}): ContextMenuGroupView | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: editor.registry.get(node.type)?.schema
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
            editor.commands.node.appearance.setStroke(nodeIds, option.value)
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
            editor.commands.node.appearance.setStrokeWidth(nodeIds, value)
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
                  editor.commands.node.appearance.setOpacity(nodeIds, option.value)
                }
              }))
            }
          ]
        : [])
    ]
  }
}

const readCanvasMenuView = ({
  editor,
  screen,
  world,
  close
}: {
  editor: ContextMenuHost
  screen: Point
  world: Point
  close: () => void
}): ContextMenuView => {
  const frame = editor.read.frame.scope.get()

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
            onSelect: runMenuAction(() => editor.commands.clipboard.paste({
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
          onSelect: runMenuAction(() => editor.commands.insert.preset(preset.key, {
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
            onSelect: runMenuAction(() => editor.commands.history.undo(), close)
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onSelect: runMenuAction(() => editor.commands.history.redo(), close)
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
            onSelect: runMenuAction(() => editor.commands.selection.selectAll(), close)
          }
        ]
      }
    ]
  }
}

const readNodeMenuView = ({
  editor,
  screen,
  nodes,
  close
}: {
  editor: ContextMenuHost
  screen: Point
  nodes: readonly Node[]
  close: () => void
}): ContextMenuView => {
  const selectionMenu = readSelectionMenuView({
    editor: {
      commands: () => editor.commands,
      registry: editor.registry
    },
    nodes,
    close
  })
  const styleGroup = buildSelectionStyleGroup({
    editor,
    nodes,
    close
  })

  return {
    screen,
    summary: nodes.length > 1 ? selectionMenu?.summary : undefined,
    filter: selectionMenu?.filter,
    groups: [
      ...(styleGroup ? [styleGroup] : []),
      ...(selectionMenu?.groups ?? [])
    ]
  }
}

const readEdgeMenuView = ({
  editor,
  screen,
  edgeId,
  close
}: {
  editor: ContextMenuHost
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
          onSelect: runMenuAction(() => editor.commands.clipboard.copy({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onSelect: runMenuAction(() => editor.commands.clipboard.cut({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onSelect: runMenuAction(() => editor.commands.edge.delete([edgeId]), close)
        }
      ]
    }
  ]
})

export const readContextMenuView = ({
  editor,
  target,
  screen,
  close
}: {
  editor: ContextMenuHost
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
        editor,
        screen,
        world: target.world,
        close
      })
    case 'node':
      return readNodeMenuView({
        editor,
        screen,
        nodes: [target.node],
        close
      })
    case 'nodes':
      return readNodeMenuView({
        editor,
        screen,
        nodes: target.nodes,
        close
      })
    case 'edge':
      return readEdgeMenuView({
        editor,
        screen,
        edgeId: target.edgeId,
        close
      })
  }
}
