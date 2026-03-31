import { getEdgePathBounds } from '@whiteboard/core/edge'
import {
  getTargetBounds,
  type BoundsTarget
} from '@whiteboard/core/selection'
import type { Rect } from '@whiteboard/core/types'
import type { ReadFn } from '@whiteboard/engine'
import type { EdgeRead } from '../read/edge'
import {
  getNodeItemBounds,
  type NodeRead
} from '../read/node'

export type TargetBoundsQuery = {
  get: (target: BoundsTarget) => Rect | undefined
  track: (read: ReadFn, target: BoundsTarget) => Rect | undefined
}

export const createTargetBoundsQuery = ({
  node,
  edge
}: {
  node: Pick<NodeRead, 'item'>
  edge: Pick<EdgeRead, 'resolved'>
}): TargetBoundsQuery => {
  const readNodeBounds = (
    readItem: (nodeId: string) => ReturnType<NodeRead['item']['get']>,
    nodeId: string
  ) => {
    const item = readItem(nodeId)
    return item
      ? getNodeItemBounds(item)
      : undefined
  }

  const readResolvedEdgeBounds = (
    readResolved: (edgeId: string) => ReturnType<EdgeRead['resolved']['get']>,
    edgeId: string
  ) => {
    const resolved = readResolved(edgeId)
    return resolved
      ? getEdgePathBounds(resolved.path)
      : undefined
  }

  return {
    get: (target) => getTargetBounds({
      target,
      readNodeBounds: (nodeId) => readNodeBounds(node.item.get, nodeId),
      readEdgeBounds: (edgeId) => readResolvedEdgeBounds(
        edge.resolved.get,
        edgeId
      )
    }),
    track: (readStore, target) => getTargetBounds({
      target,
      readNodeBounds: (nodeId) => readNodeBounds(
        (nextNodeId) => readStore(node.item, nextNodeId),
        nodeId
      ),
      readEdgeBounds: (edgeId) => readResolvedEdgeBounds(
        (nextEdgeId) => readStore(edge.resolved, nextEdgeId),
        edgeId
      )
    })
  }
}
