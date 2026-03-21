import type { EngineRead } from '@whiteboard/engine'
import type { NodeRegistry } from '../../types/node'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgeFeatureRuntime } from '../../features/edge/session/runtime'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { Source as SelectionSource } from '../selection'
import type { Tool } from '../tool'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import {
  createNodeChromeRead,
  createNodeItemRead,
  type NodeRead
} from './node'
import { createEdgeRead } from './edge'
import { createMindmapRead } from './mindmap'
import { createToolRead, type ToolRead } from './tool'
import { createEditRead, type EditRead } from './edit'
import { createSliceRead, type SliceRead } from './slice'
import { createDrawRead, type DrawRead } from './draw'
import type { DrawRuntime } from '../draw'
import {
  createSelectionRead,
  type SelectionRead
} from './selection'

export type RuntimeRead = Omit<EngineRead, 'node'> & {
  node: NodeRead
  selection: SelectionRead
  tool: ToolRead
  edit: EditRead
  slice: SliceRead
  draw: DrawRead
}

export const createRuntimeRead = ({
  engineRead,
  registry,
  tool,
  edit,
  selection,
  interaction,
  node,
  edge,
  mindmap,
  draw
}: {
  engineRead: EngineRead
  registry: NodeRegistry
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  selection: ReadStore<SelectionSource>
  interaction: ReadStore<InteractionMode>
  node: Pick<NodeFeatureRuntime, 'session' | 'press'>
  edge: Pick<EdgeFeatureRuntime, 'path'>
  mindmap: Pick<MindmapFeatureRuntime, 'drag'>
  draw: Pick<DrawRuntime, 'read'>
}): RuntimeRead => {
  const nodeItem = createNodeItemRead({
    read: engineRead,
    session: node.session
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem,
    session: edge.path
  })
  const selectionRead = createSelectionRead({
    source: selection,
    nodeItem,
    edgeItem: edgeRead.item,
    registry
  })
  const nodeRead: NodeRead = {
    list: engineRead.node.list,
    item: nodeItem,
    chrome: createNodeChromeRead({
      tool,
      edit,
      selection: selectionRead,
      interaction,
      press: node.press
    })
  }
  const mindmapRead = createMindmapRead({
    read: engineRead,
    session: mindmap.drag
  })

  return {
    node: nodeRead,
    edge: edgeRead,
    mindmap: mindmapRead,
    selection: selectionRead,
    tree: engineRead.tree,
    slice: createSliceRead({
      read: engineRead,
      selection: selectionRead
    }),
    index: engineRead.index,
    draw: createDrawRead({
      draw: draw.read
    }),
    tool: createToolRead({
      tool
    }),
    edit: createEditRead({
      edit
    })
  }
}
