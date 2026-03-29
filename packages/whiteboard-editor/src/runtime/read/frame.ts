import type { NodeId } from '@whiteboard/core/types'
import type { ReadStore } from '@whiteboard/engine'
import type { FrameScope } from '../frame'
import {
  hasEdge,
  hasNode
} from '../frame'

export const createFrameRead = ({
  scope
}: {
  scope: ReadStore<FrameScope>
}) => ({
  scope,
  hasNode: (nodeId: NodeId) => hasNode(scope.get(), nodeId),
  hasEdge: (edge: Parameters<typeof hasEdge>[1]) => hasEdge(scope.get(), edge)
})
