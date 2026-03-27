import type {
  EdgeId,
  Node as WhiteboardNode,
  NodeId,
  NodeSchema,
  Point
} from '@whiteboard/core/types'
import type { ContextResolved } from '../../../runtime/input/pointer'
import type { InternalInstance } from '../../../runtime/instance'
import type { NodeMeta } from '../../../types/node'
import { createNodeSelectionActions } from '../../node/actions'
import { toNodeStyleUpdates } from '../../node/patch'
import type { NodeSummary } from '../../node/summary'
import { insertPreset } from '../../toolbox/insert'
import { CREATE_PRESETS } from '../../toolbox/presets'
import {
  copy,
  cut,
  paste
} from '../actions/clipboard'
import {
  COLOR_OPTIONS,
  DRAW_STROKE_WIDTHS,
  OPACITY_OPTIONS,
  STROKE_WIDTHS
} from './options'
import {
  bindNodeMenuGroup,
  readNodeContextMenuGroups,
  readNodeMenuFilter,
  type NodeMenuFilter,
  type NodeMenuGroup
} from './menuModel'

export type ContextMenuView = {
  summary?: NodeSummary
  filter?: NodeMenuFilter
  groups: readonly NodeMenuGroup[]
}

export type ContextMenuSelectionSnapshot = {
  nodeIds: readonly NodeId[]
  edgeIds: readonly EdgeId[]
}

export type ContextMenuResolveMeta = (
  node: WhiteboardNode
) => NodeMeta | undefined

type ContextMenuInstance = Pick<
  InternalInstance,
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
  instance: Pick<InternalInstance, 'commands'>,
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
  nodes
}: {
  instance: Pick<ContextMenuInstance, 'registry' | 'commands'>
  nodes: readonly WhiteboardNode[]
}): NodeMenuGroup | undefined => {
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

  return {
    key: 'style',
    title: 'Style',
    items: [
      {
        key: 'style.stroke',
        label: 'Stroke',
        children: COLOR_OPTIONS.map((option) => ({
          key: `style.stroke.${option.label.toLowerCase()}`,
          label: withCurrentLabel(option.label, stroke === option.value),
          onClick: () => {
            instance.commands.node.updateMany(
              toNodeStyleUpdates(nodes, { stroke: option.value })
            )
          }
        }))
      },
      {
        key: 'style.width',
        label: 'Width',
        children: strokeWidths.map((value) => ({
          key: `style.width.${value}`,
          label: withCurrentLabel(`${value}`, strokeWidth === value),
          onClick: () => {
            instance.commands.node.updateMany(
              toNodeStyleUpdates(nodes, { strokeWidth: value })
            )
          }
        }))
      },
      ...(supportsOpacity
        ? [
            {
              key: 'style.opacity',
              label: 'Opacity',
              children: OPACITY_OPTIONS.map((option) => ({
                key: `style.opacity.${option.label}`,
                label: withCurrentLabel(option.label, opacity === option.value),
                onClick: () => {
                  instance.commands.node.updateMany(
                    toNodeStyleUpdates(nodes, { opacity: option.value })
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
      bindNodeMenuGroup({
        key: 'edit',
        title: 'Edit',
        items: [
          {
            key: 'edit.paste',
            label: 'Paste',
            onClick: () => paste(instance, {
              at: world,
              ownerId: frame.id
            })
          }
        ]
      }, close),
      bindNodeMenuGroup({
        key: 'create',
        title: 'Create',
        items: CREATE_PRESETS.map((preset) => ({
          key: preset.key,
          label: preset.label,
          onClick: () => insertPreset({
            instance,
            preset,
            world,
            ownerId: frame.id
          })
        }))
      }, close),
      bindNodeMenuGroup({
        key: 'history',
        title: 'History',
        items: [
          {
            key: 'history.undo',
            label: 'Undo',
            onClick: () => instance.commands.history.undo()
          },
          {
            key: 'history.redo',
            label: 'Redo',
            onClick: () => instance.commands.history.redo()
          }
        ]
      }, close),
      bindNodeMenuGroup({
        key: 'selection',
        title: 'Selection',
        items: [
          {
            key: 'selection.select-all',
            label: 'Select all',
            onClick: () => instance.commands.selection.selectAll()
          }
        ]
      }, close)
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
  const nodeIds = nodes.map((node) => node.id)
  const actions = createNodeSelectionActions(instance, nodes, {
    onCopy: () => copy(instance, {
      nodeIds
    }),
    onCut: () => cut(instance, {
      nodeIds
    }),
    resolveMeta
  })
  const styleGroup = buildStrokeStyleGroup({
    instance,
    nodes
  })

  return {
    summary: nodes.length > 1 ? actions.summary : undefined,
    filter: readNodeMenuFilter(actions, close),
    groups: [
      ...(styleGroup ? [bindNodeMenuGroup(styleGroup, close)] : []),
      ...readNodeContextMenuGroups(actions, close)
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
    bindNodeMenuGroup({
      key: 'edge.actions',
      items: [
        {
          key: 'edge.copy',
          label: 'Copy',
          onClick: () => copy(instance, {
            edgeIds: [edgeId]
          })
        },
        {
          key: 'edge.cut',
          label: 'Cut',
          onClick: () => cut(instance, {
            edgeIds: [edgeId]
          })
        },
        {
          key: 'edge.delete',
          label: 'Delete',
          tone: 'danger',
          onClick: () => instance.commands.edge.delete([edgeId])
        }
      ]
    }, close)
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
