import type { EngineRead } from '@whiteboard/engine'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgeFeatureRuntime } from '../../features/edge/session/runtime'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { Tool } from '../tool'
import type { EditTarget } from '../edit'
import { createNodeRead } from './node'
import { createEdgeRead } from './edge'
import { createMindmapRead } from './mindmap'
import { createToolRead, type ToolRead } from './tool'
import { createEditRead, type EditRead } from './edit'

export type RuntimeRead = EngineRead & {
  tool: ToolRead
  edit: EditRead
}

export const createRuntimeRead = ({
  engineRead,
  tool,
  edit,
  node,
  edge,
  mindmap
}: {
  engineRead: EngineRead
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  node: Pick<NodeFeatureRuntime, 'session'>
  edge: Pick<EdgeFeatureRuntime, 'routing'>
  mindmap: Pick<MindmapFeatureRuntime, 'drag'>
}): RuntimeRead => {
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
    index: engineRead.index,
    tool: createToolRead({
      tool
    }),
    edit: createEditRead({
      edit
    })
  }
}
