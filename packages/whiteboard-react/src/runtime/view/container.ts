import type {
  Edge,
  EdgeId,
  NodeId
} from '@whiteboard/core/types'
import { useInternalInstance, useView } from '../hooks'
import type { InternalWhiteboardInstance } from '../instance'
import { isOrderedArrayEqual } from '../utils/equality'

export type ScopeView = {
  activeId?: NodeId
  activeTitle?: string
  nodeIds: readonly NodeId[]
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: EdgeId | Pick<Edge, 'source' | 'target'>) => boolean
}

const EMPTY_SCOPE_NODE_IDS: readonly NodeId[] = []

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
  const activeId = instance.read.container.activeId()
  const activeNode = activeId
    ? instance.read.node.get(activeId)?.node
    : undefined

  return {
    activeId,
    activeTitle: activeNode ? resolveScopeTitle(activeNode) : undefined,
    nodeIds: activeId
      ? instance.read.container.nodeIds()
      : EMPTY_SCOPE_NODE_IDS,
    hasNode: (nodeId) => instance.read.container.hasNode(nodeId),
    hasEdge: (edge) => instance.read.container.hasEdge(edge)
  }
}

export const useScopeView = (): ScopeView => {
  const instance = useInternalInstance()
  return useView(instance.view.scope)
}

export const isScopeViewEqual = (
  left: ScopeView,
  right: ScopeView
) => (
  left.activeId === right.activeId
  && left.activeTitle === right.activeTitle
  && isOrderedArrayEqual(left.nodeIds, right.nodeIds)
)
