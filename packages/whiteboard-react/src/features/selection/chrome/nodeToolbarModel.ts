import type { Node, NodeSchema, Point, Rect } from '@whiteboard/core/types'
import type { Editor } from '../../../runtime/instance'
import type {
  NodeSelectionCan,
  NodeSummary
} from '../../node/summary'
import {
  buildToolbarItem,
  hasSchemaField,
  readTextFieldKey,
  readTextValue,
  resolveToolbarItemKeys,
  resolveToolbarPlacement,
  type ToolbarItem,
  type ToolbarPlacement
} from './layout'
import type { ToolbarIconState } from './nodeToolbarIcon'

type ToolbarSelection = {
  box?: Rect
  can: NodeSelectionCan
  summary: NodeSummary
  items: {
    nodes: readonly Node[]
    primaryNode?: Node
  }
}

export type NodeToolbarModel = {
  items: readonly ToolbarItem[]
  nodes: readonly Node[]
  summary: NodeSummary
  can: NodeSelectionCan
  primaryNode: Node
  primarySchema?: NodeSchema
  placement: ToolbarPlacement
  anchor: Point
  iconState: ToolbarIconState
  fillValue?: string
  strokeValue: string
  strokeWidthValue: number
  strokeOpacityValue?: number
  textValue: string
  textFieldKey: 'title' | 'text'
  textColor: string
  textFontSize?: number
  showTextSection: boolean
  showTextColorSection: boolean
  showTextFontSizeSection: boolean
  showStrokeOpacitySection: boolean
  drawOnlyStrokeMenu: boolean
}

export const resolveNodeToolbarModel = ({
  instance,
  selection,
  worldToScreen
}: {
  instance: Pick<Editor, 'host'>
  selection: ToolbarSelection
  worldToScreen: (point: Point) => Point
}): NodeToolbarModel | undefined => {
  const rect = selection.box
  const nodes = selection.items.nodes
  const primaryNode = selection.items.primaryNode

  if (!rect || !primaryNode || !nodes.length) {
    return undefined
  }

  const items = resolveToolbarItemKeys(selection.can, nodes.length).map((key) => (
    buildToolbarItem(key)
  ))
  if (!items.length) {
    return undefined
  }

  const { placement, anchor } = resolveToolbarPlacement({
    worldToScreen,
    rect
  })
  const primarySchema = instance.host.registry.get(primaryNode.type)?.schema
  const fillValue = typeof primaryNode.style?.fill === 'string'
    ? primaryNode.style.fill
    : primaryNode.type === 'sticky' && typeof primaryNode.data?.background === 'string'
      ? primaryNode.data.background
      : undefined
  const strokeValue = typeof primaryNode.style?.stroke === 'string'
    ? primaryNode.style.stroke
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const strokeWidthValue = typeof primaryNode.style?.strokeWidth === 'number'
    ? primaryNode.style.strokeWidth
    : 1
  const strokeOpacityValue = typeof primaryNode.style?.opacity === 'number'
    ? primaryNode.style.opacity
    : undefined
  const textFieldKey = readTextFieldKey(primaryNode, primarySchema)
  const textValue = readTextValue(primaryNode, primarySchema)
  const textColor = typeof primaryNode.style?.color === 'string'
    ? primaryNode.style.color
    : 'hsl(var(--ui-text-primary, 40 2.1% 28%))'
  const textFontSize = typeof primaryNode.style?.fontSize === 'number'
    ? primaryNode.style.fontSize
    : undefined

  return {
    items,
    nodes,
    summary: selection.summary,
    can: selection.can,
    primaryNode,
    primarySchema,
    placement,
    anchor,
    iconState: {
      fill: fillValue,
      stroke: strokeValue,
      strokeWidth: strokeWidthValue,
      opacity: strokeOpacityValue
    },
    fillValue,
    strokeValue,
    strokeWidthValue,
    strokeOpacityValue,
    textValue,
    textFieldKey,
    textColor,
    textFontSize,
    showTextSection: !primarySchema
      || hasSchemaField(primarySchema, 'data', 'text')
      || hasSchemaField(primarySchema, 'data', 'title'),
    showTextColorSection: !primarySchema
      || hasSchemaField(primarySchema, 'style', 'color'),
    showTextFontSizeSection: !primarySchema
      || hasSchemaField(primarySchema, 'style', 'fontSize'),
    showStrokeOpacitySection:
      hasSchemaField(primarySchema, 'style', 'opacity')
      || typeof primaryNode.style?.opacity === 'number',
    drawOnlyStrokeMenu: nodes.every((node) => node.type === 'draw')
  }
}
