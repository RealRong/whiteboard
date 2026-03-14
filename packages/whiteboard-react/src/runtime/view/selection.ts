import { useInternalInstance, useView } from '../hooks'
import type { EdgeId, Node, NodeId, Rect } from '@whiteboard/core/types'
import type { NodeViewItem } from '@whiteboard/engine'
import type { InternalWhiteboardInstance } from '../instance'

export type SelectionKind = 'none' | 'node' | 'nodes' | 'edge'

export type NodeActions = {
  nodeIds: readonly NodeId[]
  nodeCount: number
  hasGroup: boolean
  allLocked: boolean
  canDelete: boolean
  canDuplicate: boolean
  canGroup: boolean
  canUngroup: boolean
  canLock: boolean
  canUnlock: boolean
  lockLabel: string
}

export type SelectionState = NodeActions & {
  kind: SelectionKind
  nodeIdSet: ReadonlySet<NodeId>
  edgeId?: EdgeId
  nodes: readonly Node[]
  primaryNode?: Node
  rect?: Rect
  hasNodeSelection: boolean
  hasEdgeSelection: boolean
  hasSelection: boolean
  activeScopeId?: NodeId
  hasActiveScope: boolean
  canSelectAll: boolean
  canClear: boolean
}

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET = new Set<NodeId>()
const EMPTY_NODES: readonly Node[] = []

const isSameNodeIds = (
  left: readonly NodeId[],
  right: readonly NodeId[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((nodeId, index) => nodeId === right[index])
  )
)

const isSameNodes = (
  left: readonly Node[],
  right: readonly Node[]
) => (
  left === right
  || (
    left.length === right.length
    && left.every((node, index) => node === right[index])
  )
)

export const isRectEqual = (
  left: Rect | undefined,
  right: Rect | undefined
) => (
  left === right
  || (
    left?.x === right?.x
    && left?.y === right?.y
    && left?.width === right?.width
    && left?.height === right?.height
  )
)

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

export const resolveNodeActions = (
  nodes: readonly Node[]
): NodeActions => {
  const nodeIds = nodes.length > 0 ? nodes.map((node) => node.id) : EMPTY_NODE_IDS
  const nodeCount = nodeIds.length
  const hasGroup = nodes.some((node) => node.type === 'group')
  const allLocked = nodeCount > 0 && nodes.every((node) => Boolean(node.locked))
  const multiple = nodeCount > 1

  return {
    nodeIds,
    nodeCount,
    hasGroup,
    allLocked,
    canDelete: nodeCount > 0,
    canDuplicate: nodeCount > 0,
    canGroup: nodeCount >= 2,
    canUngroup: hasGroup,
    canLock: nodeCount > 0 && !allLocked,
    canUnlock: allLocked,
    lockLabel: allLocked
      ? (multiple ? 'Unlock selected' : 'Unlock')
      : (multiple ? 'Lock selected' : 'Lock')
  }
}

export const resolveSelectionState = ({
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
    hasNodeSelection,
    hasEdgeSelection,
    hasSelection,
    activeScopeId,
    hasActiveScope,
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
  && left.activeScopeId === right.activeScopeId
  && left.hasNodeSelection === right.hasNodeSelection
  && left.hasEdgeSelection === right.hasEdgeSelection
  && left.hasSelection === right.hasSelection
  && left.hasActiveScope === right.hasActiveScope
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
  && isSameNodeIds(left.nodeIds, right.nodeIds)
  && isSameNodes(left.nodes, right.nodes)
  && isRectEqual(left.rect, right.rect)
)
