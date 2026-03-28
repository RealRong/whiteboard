import type {
  Node as WhiteboardNode,
  NodeSchema
} from '@whiteboard/core/types'
import type { Editor } from '../../../runtime/instance'
import {
  COLOR_OPTIONS,
  DRAW_STROKE_WIDTHS,
  OPACITY_OPTIONS,
  STROKE_WIDTHS
} from './menus/options'
import { runMenuAction } from './selectionMenuActions'
import type {
  ContextMenuGroup,
  ContextMenuItem
} from './contextMenuTypes'

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

export const buildSelectionStyleContextMenuGroup = ({
  instance,
  nodes,
  close
}: {
  instance: Pick<Editor, 'host' | 'commands'>
  close: () => void
  nodes: readonly WhiteboardNode[]
}): ContextMenuGroup | undefined => {
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
