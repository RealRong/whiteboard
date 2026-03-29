import {
  getTargetBounds
} from '@whiteboard/core/node'
import type { Node, NodeId, Rect } from '@whiteboard/core/types'
import type {
  EngineRead,
  KeyedReadStore,
  NodeItem
} from '@whiteboard/engine'
import type { NodeRead } from './node'

export const createBoundsRead = ({
  engineRead,
  nodeRead,
  nodeItem,
  edgeRead
}: {
  engineRead: EngineRead
  nodeRead: NodeRead
  nodeItem: KeyedReadStore<NodeId, NodeItem | undefined>
  edgeRead: {
    bounds: (edgeId: string) => Rect | undefined
  }
}): EngineRead['bounds'] => {
  const readRuntimeNodes = () => engineRead.node.list.get()
    .map((nodeId) => nodeItem.get(nodeId)?.node)
    .filter((node): node is Node => Boolean(node))

  return {
    canvas: engineRead.bounds.canvas,
    targets: (input) => getTargetBounds({
      input,
      nodes: readRuntimeNodes(),
      readNodeBounds: nodeRead.bounds,
      readEdgeBounds: edgeRead.bounds
    })
  }
}
