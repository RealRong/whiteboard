import type { EngineRead } from '@whiteboard/engine'
import type { WhiteboardRead } from '../instance'
import type { NodeFeatureRuntime } from '../../features/node/session'
import type { EdgeFeatureRuntime } from '../../features/edge/session'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session'
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
}): WhiteboardRead => {
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
