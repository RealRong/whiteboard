import type { EngineRead } from '@whiteboard/engine'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgeFeatureRuntime } from '../../features/edge/session/runtime'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { View as SelectionView } from '../selection'
import type { Tool } from '../tool'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import {
  createNodeRead,
  type NodeRead
} from './node'
import { createEdgeRead } from './edge'
import { createMindmapRead } from './mindmap'
import { createToolRead, type ToolRead } from './tool'
import { createEditRead, type EditRead } from './edit'
import { createSliceRead, type SliceRead } from './slice'

export type RuntimeRead = Omit<EngineRead, 'node'> & {
  node: NodeRead
  tool: ToolRead
  edit: EditRead
  slice: SliceRead
}

export const createRuntimeRead = ({
  engineRead,
  tool,
  edit,
  selection,
  interaction,
  node,
  edge,
  mindmap
}: {
  engineRead: EngineRead
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionView>
  interaction: ReadStore<InteractionMode>
  node: Pick<NodeFeatureRuntime, 'session' | 'press'>
  edge: Pick<EdgeFeatureRuntime, 'path'>
  mindmap: Pick<MindmapFeatureRuntime, 'drag'>
}): RuntimeRead => {
  const nodeRead = createNodeRead({
    read: engineRead,
    session: node.session,
    tool,
    edit,
    selection,
    interaction,
    press: node.press
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem: nodeRead.item,
    session: edge.path
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
    slice: createSliceRead({
      read: engineRead,
      selection
    }),
    index: engineRead.index,
    tool: createToolRead({
      tool
    }),
    edit: createEditRead({
      edit
    })
  }
}
