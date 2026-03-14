import { useInternalInstance, useView } from '../hooks'
import type { EdgeId, Node, NodeId, Rect } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import type { InternalWhiteboardInstance } from '../instance'
import type { NodeActions } from '../../features/node/nodeActions'
import { resolveNodeActions } from '../../features/node/nodeActions'
import {
  isOrderedArrayEqual,
  isRectEqual
} from '../utils/equality'

export type SelectionKind = 'none' | 'node' | 'nodes' | 'edge'

export type SelectionState = NodeActions & {
  kind: SelectionKind
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId
  nodes: readonly Node[]
  primaryNode?: Node
  rect?: Rect
  canSelectAll: boolean
  canClear: boolean
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET = new Set<NodeId>()
const EMPTY_NODES: readonly Node[] = []

export { isRectEqual }

const getBoundingRect = (rects: readonly Rect[]): Rect | undefined => {
  if (!rects.length) return undefined

  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY

  rects.forEach((rect) => {
    minX = Math.min(minX, rect.x)
    minY = Math.min(minY, rect.y)
    maxX = Math.max(maxX, rect.x + rect.width)
    maxY = Math.max(maxY, rect.y + rect.height)
  })

  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  ) {
    return undefined
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(0, maxX - minX),
    height: Math.max(0, maxY - minY)
  }
}

const readNodeItems = (
  instance: InternalWhiteboardInstance,
  nodeIds: readonly NodeId[]
): readonly NodeViewItem[] => nodeIds
  .map((nodeId) => instance.read.node.get(nodeId))
  .filter((item): item is NodeViewItem => Boolean(item))

const resolveSelectionState = ({
  nodeIds,
  nodeIdSet,
  edgeId,
  items,
  activeScopeId
}: {
  nodeIds: readonly NodeId[]
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId
  items: readonly NodeViewItem[]
  activeScopeId?: NodeId
}): SelectionState => {
  const nodes = items.length > 0 ? items.map((item) => item.node) : EMPTY_NODES
  const rect = items.length > 0 ? getBoundingRect(items.map((item) => item.rect)) : undefined
  const node = resolveNodeActions(nodes)
  const hasNodeSelection = node.nodeCount > 0
  const hasEdgeSelection = edgeId !== undefined
  const hasSelection = hasNodeSelection || hasEdgeSelection
  const hasActiveScope = activeScopeId !== undefined

  return {
    kind: edgeId !== undefined
      ? 'edge'
      : node.nodeCount === 1
        ? 'node'
        : node.nodeCount > 1
          ? 'nodes'
          : 'none',
    ...node,
    nodeIds: node.nodeCount > 0 ? nodeIds : EMPTY_NODE_IDS,
    nodeIdSet: node.nodeCount > 0 ? nodeIdSet : EMPTY_NODE_SET,
    edgeId,
    nodes,
    primaryNode: nodes[0],
    rect,
    canDelete: hasSelection,
    canDuplicate: hasNodeSelection,
    canSelectAll: true,
    canClear: hasSelection || hasActiveScope
  }
}

export const readSelectionState = (
  instance: InternalWhiteboardInstance
): SelectionState => {
  const nodeIds = instance.state.selection.getNodeIds()
  return resolveSelectionState({
    nodeIds,
    nodeIdSet: new Set(nodeIds),
    edgeId: instance.state.selection.getEdgeId(),
    items: readNodeItems(instance, nodeIds),
    activeScopeId: instance.state.scope.getContainerId()
  })
}

export const useSelectionState = (): SelectionState => {
  const instance = useInternalInstance()
  return useView(instance.view.selection)
}

export const isSelectionStateEqual = (
  left: SelectionState,
  right: SelectionState
) => (
  left.kind === right.kind
  && left.edgeId === right.edgeId
  && left.primaryNode === right.primaryNode
  && left.canDelete === right.canDelete
  && left.canDuplicate === right.canDuplicate
  && left.canGroup === right.canGroup
  && left.canUngroup === right.canUngroup
  && left.canLock === right.canLock
  && left.canUnlock === right.canUnlock
  && left.canSelectAll === right.canSelectAll
  && left.canClear === right.canClear
  && left.nodeCount === right.nodeCount
  && left.hasGroup === right.hasGroup
  && left.allLocked === right.allLocked
  && left.lockLabel === right.lockLabel
  && isOrderedArrayEqual(left.nodeIds, right.nodeIds)
  && isOrderedArrayEqual(left.nodes, right.nodes)
  && isRectEqual(left.rect, right.rect)
)
