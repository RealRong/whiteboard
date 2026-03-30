import type { Edge, NodeId } from '../types'
import { isNodeEdgeEnd } from '../types'
import { isOrderedArrayEqual } from '../utils'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_NODE_SET: ReadonlySet<NodeId> = new Set<NodeId>()

export type FrameScope = {
  id?: NodeId
  ids: readonly NodeId[]
  set?: ReadonlySet<NodeId>
}

export const ROOT_FRAME_SCOPE: FrameScope = {
  ids: EMPTY_NODE_IDS
}

export const isFrameScopeEqual = (
  left: FrameScope,
  right: FrameScope
) => (
  left.id === right.id
  && isOrderedArrayEqual(left.ids, right.ids)
)

export const createFrameScope = (
  id: NodeId | undefined,
  ids: readonly NodeId[]
): FrameScope => {
  if (!id) {
    return ROOT_FRAME_SCOPE
  }

  return {
    id,
    ids,
    set: ids.length > 0 ? new Set(ids) : EMPTY_NODE_SET
  }
}

export const isNodeInFrameScope = (
  frame: FrameScope,
  nodeId: NodeId
): boolean => (
  frame.id
    ? Boolean(frame.set?.has(nodeId))
    : true
)

export const filterNodeIdsInFrameScope = (
  frame: FrameScope,
  nodeIds: readonly NodeId[]
): readonly NodeId[] => (
  frame.id
    ? nodeIds.filter((nodeId) => isNodeInFrameScope(frame, nodeId))
    : nodeIds
)

export const isEdgeInFrameScope = (
  frame: FrameScope,
  edge: Pick<Edge, 'source' | 'target'>
): boolean => {
  if (!frame.id) {
    return true
  }

  const hasNodeEnd =
    isNodeEdgeEnd(edge.source)
    || isNodeEdgeEnd(edge.target)

  if (!hasNodeEnd) {
    return false
  }

  return (
    (!isNodeEdgeEnd(edge.source) || isNodeInFrameScope(frame, edge.source.nodeId))
    && (!isNodeEdgeEnd(edge.target) || isNodeInFrameScope(frame, edge.target.nodeId))
  )
}
