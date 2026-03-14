import type { Node, Point, Rect } from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../../../runtime/instance'
import { readNodeView } from '../../../runtime/view/node'
import { readSelectionState } from '../../../runtime/view/selection'
import {
  resolveNodeToolbarItems,
  type NodeToolbarItem,
  type NodeToolbarSource
} from './model'

export type NodeToolbarPlacement = 'top' | 'bottom'

export type NodeToolbarView = {
  items: NodeToolbarItem[]
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NonNullable<NodeToolbarSource['schema']>
  placement: NodeToolbarPlacement
  anchor: Point
}

type ToolbarSelection = {
  rect: Rect
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NonNullable<NodeToolbarSource['schema']>
  sources: readonly NodeToolbarSource[]
}

const TOOLBAR_VERTICAL_GAP = 12
const TOOLBAR_MIN_TOP_SPACE = 56

const resolveToolbarPlacement = (
  instance: InternalWhiteboardInstance,
  rect: Rect
): {
  placement: NodeToolbarPlacement
  anchor: Point
} => {
  const topCenter = instance.viewport.worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y
  })
  const bottomCenter = instance.viewport.worldToScreen({
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height
  })
  const placement =
    topCenter.y - TOOLBAR_VERTICAL_GAP > TOOLBAR_MIN_TOP_SPACE
      ? 'top'
      : 'bottom'

  return {
    placement,
    anchor: placement === 'top' ? topCenter : bottomCenter
  }
}

const resolveSingleToolbarSelection = (
  singleNodeView: NonNullable<ReturnType<typeof readNodeView>>
): ToolbarSelection => {
  const primarySchema = singleNodeView.definition?.schema
  const node = singleNodeView.node

  return {
    rect: singleNodeView.rect,
    nodes: [node],
    primaryNode: node,
    primarySchema,
    sources: [{
      node,
      schema: primarySchema
    }]
  }
}

const resolveMultiToolbarSelection = (
  instance: InternalWhiteboardInstance,
  selection: Pick<ReturnType<typeof readSelectionState>, 'nodes' | 'primaryNode' | 'rect'>
): ToolbarSelection | undefined => {
  const rect = selection.rect
  const nodes = selection.nodes
  const primaryNode = selection.primaryNode

  if (!rect || !primaryNode || !nodes.length) {
    return undefined
  }

  return {
    rect,
    nodes,
    primaryNode,
    primarySchema: instance.registry.get(primaryNode.type)?.schema,
    sources: nodes.map((node) => ({
      node,
      schema: instance.registry.get(node.type)?.schema
    }))
  }
}

const resolveNodeToolbarView = ({
  instance,
  selection,
  singleNodeView
}: {
  instance: InternalWhiteboardInstance
  selection: Pick<ReturnType<typeof readSelectionState>, 'nodeIds' | 'nodes' | 'primaryNode' | 'rect'>
  singleNodeView?: ReturnType<typeof readNodeView>
}): NodeToolbarView | undefined => {
  const selectedNodeIds = selection.nodeIds
  const resolved =
    selectedNodeIds.length === 1 && singleNodeView
      ? resolveSingleToolbarSelection(singleNodeView)
      : selectedNodeIds.length > 1
        ? resolveMultiToolbarSelection(instance, selection)
        : undefined

  if (!resolved) return undefined

  const items = resolveNodeToolbarItems({
    sources: resolved.sources,
    nodes: resolved.nodes
  })
  if (!items.length) return undefined

  const { placement, anchor } = resolveToolbarPlacement(
    instance,
    resolved.rect
  )

  return {
    items,
    nodes: resolved.nodes,
    primaryNode: resolved.primaryNode,
    primarySchema: resolved.primarySchema,
    placement,
    anchor
  }
}

export const readNodeToolbarView = (
  instance: InternalWhiteboardInstance
): NodeToolbarView | undefined => {
  const selection = instance.view.selection.get()
  return resolveNodeToolbarView({
    instance,
    selection,
    singleNodeView: readNodeView(instance, selection.nodeIds[0], {
      selected: selection.nodeIds.length === 1
    })
  })
}
