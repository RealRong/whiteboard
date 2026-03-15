import type {
  Edge,
  EdgeId,
  NodeId
} from '@whiteboard/core/types'
import type { InternalWhiteboardInstance } from '../instance'
import { isOrderedArrayEqual } from '../utils/equality'

export type ScopeView = {
  activeId?: NodeId
  activeTitle?: string
  nodeIds: readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}

const resolveScopeTitle = (
  node: {
    type: string
    data?: Record<string, unknown>
  }
) => {
  const title = node.data?.title
  if (typeof title === 'string' && title.trim()) {
    return title.trim()
  }
  return node.type === 'group' ? 'Group' : node.type
}

export const readScopeView = (
  instance: InternalWhiteboardInstance
): ScopeView => {
  const activeId = instance.read.scope.activeId()
  const activeNode = activeId
    ? instance.read.node.get(activeId)?.node
    : undefined

  return {
    activeId,
    activeTitle: activeNode ? resolveScopeTitle(activeNode) : undefined,
    nodeIds: instance.read.scope.nodeIds(),
    hasNode: (nodeId) => instance.read.scope.hasNode(nodeId),
    hasEdge: (edge) => instance.read.scope.hasEdge(edge)
  }
}

export const isScopeViewEqual = (
  left: ScopeView,
  right: ScopeView
) => (
  left.activeId === right.activeId
  && left.activeTitle === right.activeTitle
  && isOrderedArrayEqual(left.nodeIds, right.nodeIds)
)
