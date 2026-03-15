import type {
  Edge,
  EdgeId,
  NodeId
} from '@whiteboard/core/types'
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

export const resolveScopeView = ({
  activeId,
  activeNode,
  nodeIds,
  hasNode,
  hasEdge
}: {
  activeId?: NodeId
  activeNode?: {
    type: string
    data?: Record<string, unknown>
  }
  nodeIds: readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}): ScopeView => {
  return {
    activeId,
    activeTitle: activeNode ? resolveScopeTitle(activeNode) : undefined,
    nodeIds,
    hasNode,
    hasEdge
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
