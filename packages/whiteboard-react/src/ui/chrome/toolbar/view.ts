import type { Node, NodeId, Point } from '@whiteboard/core/types'
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
  mode: 'single' | 'multi'
  nodeIds: readonly NodeId[]
  items: NodeToolbarItem[]
  nodes: readonly Node[]
  primaryNode: Node
  primarySchema?: NonNullable<NodeToolbarSource['schema']>
  placement: NodeToolbarPlacement
  anchor: Point
}

const TOOLBAR_VERTICAL_GAP = 12
const TOOLBAR_MIN_TOP_SPACE = 56

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
  const nodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : undefined
  let rect = selection.rect
  let nodes: readonly Node[] = []
  let primaryNode: Node | undefined
  let primarySchema: NodeToolbarSource['schema']
  let items: NodeToolbarItem[] = []
  let mode: 'single' | 'multi' | undefined

  if (selectedNodeIds.length === 1 && nodeId && singleNodeView) {
    rect = singleNodeView.rect
    nodes = [singleNodeView.node]
    primaryNode = singleNodeView.node
    primarySchema = singleNodeView.definition?.schema
    items = resolveNodeToolbarItems({
      sources: [{
        node: singleNodeView.node,
        schema: primarySchema
      }],
      nodes
    })
    mode = 'single'
  } else if (selectedNodeIds.length > 1) {
    if (!rect) return undefined
    nodes = selection.nodes
    primaryNode = selection.primaryNode
    if (!primaryNode || !nodes.length) return undefined
    primarySchema = instance.registry.get(primaryNode.type)?.schema
    items = resolveNodeToolbarItems({
      sources: nodes.map((item) => ({
        node: item,
        schema: instance.registry.get(item.type)?.schema
      })),
      nodes
    })
    mode = 'multi'
  }

  if (!rect || !primaryNode || !mode || !items.length) return undefined

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
  const anchor = placement === 'top' ? topCenter : bottomCenter

  return {
    mode,
    nodeIds: selectedNodeIds,
    items,
    nodes,
    primaryNode,
    primarySchema,
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
