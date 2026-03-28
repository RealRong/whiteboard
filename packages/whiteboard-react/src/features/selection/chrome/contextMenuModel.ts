import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import type { ContextResolved } from '../../../runtime/input/target'
import type { InternalEditor } from '../../../runtime/instance/types'
import type { NodeMeta } from '../../../types/node'
import {
  resolveNodeSelectionCan,
  summarizeNodes,
  type NodeSummary
} from '../../node/summary'
import { CREATE_PRESETS } from '../../toolbox/presets'
import {
  COLOR_OPTIONS,
  DRAW_STROKE_WIDTHS,
  OPACITY_OPTIONS,
  STROKE_WIDTHS
} from './menus/options'
import {
  resolveSelectionContextMenuGroups,
  resolveSelectionFilter,
  runMenuAction,
  type SelectionMenuFilter
} from './selectionMenu'
import type {
  ContextMenuGroup,
  ContextMenuItem
} from './contextMenuTypes'

export type ContextMenuView = {
  summary?: NodeSummary
  filter?: SelectionMenuFilter
  groups: readonly ContextMenuGroup[]
}

export type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type ContextMenuResolveMeta = (
  node: WhiteboardNode
) => NodeMeta | undefined

type ContextMenuInstance = Pick<
  InternalEditor,
  'commands' | 'read' | 'state' | 'registry' | 'viewport'
>

export const snapshotContextMenuSelection = (
  nodeIds: readonly NodeId[],
  edgeIds: readonly EdgeId[]
): ContextMenuSelectionSnapshot => ({
  nodeIds,
  edgeIds
})

export const restoreContextMenuSelection = (
  instance: Pick<InternalEditor, 'commands'>,
  selection: ContextMenuSelectionSnapshot
) => {
  if (selection.nodeIds.length > 0 || selection.edgeIds.length > 0) {
    instance.commands.selection.replace({
      nodeIds: selection.nodeIds,
      edgeIds: selection.edgeIds
    })
    return
  }

  instance.commands.selection.clear()
}

const hasStyleField = (
  schema: NodeSchema | undefined,
  path: string
) => schema?.fields.some((field) => field.scope === 'style' && field.path === path) ?? false

const canEditStrokeStyle = (
  node: WhiteboardNode,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'stroke')
  || hasStyleField(schema, 'strokeWidth')
  || typeof node.style?.stroke === 'string'
  || typeof node.style?.strokeWidth === 'number'
)

const canEditOpacityStyle = (
  node: WhiteboardNode,
  schema: NodeSchema | undefined
) => (
  hasStyleField(schema, 'opacity')
  || typeof node.style?.opacity === 'number'
)

const withCurrentLabel = (
  label: string,
  active: boolean
) => active ? `${label} (Current)` : label

const buildStrokeStyleGroup = ({
  instance,
  nodes,
  close
}: {
  instance: Pick<ContextMenuInstance, 'registry' | 'commands'>
  close: () => void
  nodes: readonly WhiteboardNode[]
}): ContextMenuGroup | undefined => {
  if (!nodes.length) {
    return undefined
  }

  const sources = nodes.map((node) => ({
    node,
    schema: instance.registry.get(node.type)?.schema
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

  const bindChild = (
    item: Omit<ContextMenuItem, 'onClick'> & {
      onClick?: () => unknown
    }
  ): ContextMenuItem => ({
    ...item,
    onClick: item.onClick
      ? runMenuAction(item.onClick, close)
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
          onClick: () => {
            instance.commands.node.appearance.setStroke(
              nodes.map((node) => node.id),
              option.value
            )
          }
        }))
      },
      {
        key: 'style.width',
        label: 'Width',
        children: strokeWidths.map((value) => bindChild({
          key: `style.width.${value}`,
          label: withCurrentLabel(`${value}`, strokeWidth === value),
          onClick: () => {
            instance.commands.node.appearance.setStrokeWidth(
              nodes.map((node) => node.id),
              value
            )
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
                onClick: () => {
                  instance.commands.node.appearance.setOpacity(
                    nodes.map((node) => node.id),
                    option.value
                  )
                }
              }))
            }
          ]
        : [])
    ]
  }
}

const readCanvasMenuView = ({
  instance,
  world,
  close
}: {
  instance: ContextMenuInstance
  world: Point
  close: () => void
}): ContextMenuView => {
  const frame = instance.state.frame.get()

  return {
    groups: [
      {
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.paste',
            label: 'Paste',
            onClick: runMenuAction(() => instance.commands.clipboard.paste({
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
          onClick: runMenuAction(() => instance.commands.insert.preset(preset.key, {
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
            onClick: runMenuAction(() => instance.commands.history.undo(), close)
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onClick: runMenuAction(() => instance.commands.history.redo(), close)
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
            onClick: runMenuAction(() => instance.commands.selection.selectAll(), close)
          }
        ]
      }
    ]
  }
}

const readNodeMenuView = ({
  instance,
  nodes,
  close,
  resolveMeta
}: {
  instance: ContextMenuInstance
  nodes: readonly WhiteboardNode[]
  close: () => void
  resolveMeta?: ContextMenuResolveMeta
}): ContextMenuView => {
  const summary = summarizeNodes(nodes, {
    resolveMeta
  })
  const can = resolveNodeSelectionCan(nodes, {
    resolveMeta
  })
  const styleGroup = buildStrokeStyleGroup({
    instance,
    nodes,
    close
  })

  return {
    summary: nodes.length > 1 ? summary : undefined,
    filter: resolveSelectionFilter({
      instance,
      nodes,
      summary,
      can,
      resolveMeta,
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
  edgeId,
  close
}: {
  instance: ContextMenuInstance
  edgeId: EdgeId
  close: () => void
}): ContextMenuView => ({
  groups: [
    {
      key: 'edge.actions',
      items: [
        {
          key: 'edge.copy',
          label: 'Copy',
          onClick: runMenuAction(() => instance.commands.clipboard.copy({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onClick: runMenuAction(() => instance.commands.clipboard.cut({
            edgeIds: [edgeId]
          }), close)
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: runMenuAction(() => instance.commands.edge.delete([edgeId]), close)
        }
      ]
    }
  ]
})

export const readContextMenuView = ({
  instance,
  target,
  close,
  resolveMeta
}: {
  instance: ContextMenuInstance
  target: ContextResolved | undefined
  close: () => void
  resolveMeta?: ContextMenuResolveMeta
}): ContextMenuView | undefined => {
  if (!target) {
    return undefined
  }

  switch (target.kind) {
    case 'canvas':
      return readCanvasMenuView({
        instance,
        world: target.world,
        close
      })
    case 'node':
      return readNodeMenuView({
        instance,
        nodes: [target.node],
        close,
        resolveMeta
      })
    case 'nodes':
      return readNodeMenuView({
        instance,
        nodes: target.nodes,
        close,
        resolveMeta
      })
    case 'edge':
      return readEdgeMenuView({
        instance,
        edgeId: target.edgeId,
        close
      })
  }
}
