import type {
  Edge,
  EdgeId,
  NodeId
} from '@whiteboard/core/types'
import { isOrderedArrayEqual } from '../utils/equality'

export type ContainerView = {
  activeId?: NodeId
  activeTitle?: string
  nodeIds: readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}

const resolveContainerTitle = (
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

export const resolveContainerView = ({
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
}): ContainerView => {
  return {
    activeId,
    activeTitle: activeNode ? resolveContainerTitle(activeNode) : undefined,
    nodeIds,
    hasNode,
    hasEdge
  }
}

export const isContainerViewEqual = (
  left: ContainerView,
  right: ContainerView
) => (
  left.activeId === right.activeId
  && left.activeTitle === right.activeTitle
  && isOrderedArrayEqual(left.nodeIds, right.nodeIds)
)
