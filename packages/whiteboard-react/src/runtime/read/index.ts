import type { EngineRead } from '@whiteboard/engine'
import type { WhiteboardInstance } from '../instance'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgeFeatureRuntime } from '../../features/edge/session/runtime'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import { createNodeRead } from './node'
import { createEdgeRead } from './edge'
import { createMindmapRead } from './mindmap'

export const createRuntimeRead = ({
  engineRead,
  node,
  edge,
  mindmap
}: {
  engineRead: EngineRead
  node: Pick<NodeFeatureRuntime, 'session'>
  edge: Pick<EdgeFeatureRuntime, 'routing'>
  mindmap: Pick<MindmapFeatureRuntime, 'drag'>
}): WhiteboardInstance['read'] => {
  const nodeRead = createNodeRead({
    read: engineRead,
    session: node.session
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem: nodeRead.item,
    session: edge.routing
  })
  const mindmapRead = createMindmapRead({
    read: engineRead,
    session: mindmap.drag
  })

  return {
    node: nodeRead,
    edge: edgeRead,
    mindmap: mindmapRead,
    tree: engineRead.tree,
    index: engineRead.index
  }
}
