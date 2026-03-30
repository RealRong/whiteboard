import {
  isEdgeInFrameScope,
  isNodeInFrameScope,
  type FrameScope
} from '@whiteboard/core/document'
import type { Edge, NodeId } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/engine'

export type FrameRead = {
  scope: ReadStore<FrameScope>
  hasNode: (nodeId: NodeId) => boolean
  hasEdge: (edge: Edge) => boolean
}

export const createFrameRead = ({
  scope
}: {
  scope: ReadStore<FrameScope>
}): FrameRead => ({
  scope,
  hasNode: (nodeId: NodeId) => isNodeInFrameScope(scope.get(), nodeId),
  hasEdge: (edge: Edge) => isEdgeInFrameScope(scope.get(), edge)
})
