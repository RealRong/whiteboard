import type { FrameScope } from '@whiteboard/core/document'
import type { SelectionTarget } from '@whiteboard/core/selection'
import type { EngineRead, ReadStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import { resolveNodeTransform } from '@whiteboard/core/node'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { NodeProjectionRuntime } from '../projection/node'
import type { EdgeProjectionRuntime } from '../projection/edge'
import type { Tool } from '../tool'
import {
  createNodeRead,
  createNodeInteractionRead,
  createNodeItemRead,
  type NodeRead
} from './node'
import { createBoundsRead } from './bounds'
import {
  createEdgeRead,
  type EdgeRead
} from './edge'
import {
  createFrameRead,
  type FrameRead
} from './frame'
import {
  createSelectionRead,
  type SelectionRead
} from './selection'
import { createToolRead, type ToolRead } from './tool'

export type RuntimeRead = Omit<EngineRead, 'node' | 'edge' | 'bounds'> & {
  history: ReadStore<HistoryState>
  bounds: EngineRead['bounds']
  node: NodeRead
  edge: EdgeRead
  selection: SelectionRead
  tool: ToolRead
  frame: FrameRead
  draw: {
    preferences: ReadStore<DrawPreferences>
  }
}

export const createRead = ({
  engineRead,
  registry,
  tool,
  history,
  drawPreferences,
  selection,
  frame,
  node,
  edge
}: {
  engineRead: EngineRead
  registry: NodeRegistry
  tool: ReadStore<Tool>
  history: ReadStore<HistoryState>
  drawPreferences: ReadStore<DrawPreferences>
  selection: ReadStore<SelectionTarget>
  frame: ReadStore<FrameScope>
  node: Pick<NodeProjectionRuntime, 'store'>
  edge: Pick<EdgeProjectionRuntime, 'patch'>
}): RuntimeRead => {
  const nodeItem = createNodeItemRead({
    read: engineRead,
    projection: node.store
  })
  const nodeInteraction = createNodeInteractionRead({
    projection: node.store
  })
  const nodeRead: NodeRead = createNodeRead({
    read: engineRead,
    registry,
    item: nodeItem,
    interaction: nodeInteraction
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem,
    patch: edge.patch,
    connect: nodeRead.connect
  })
  const bounds = createBoundsRead({
    engineRead,
    nodeRead,
    nodeItem,
    edgeRead
  })
  const selectionRead = createSelectionRead({
    source: selection,
    nodeItem,
    edgeItem: edgeRead.item,
    bounds: bounds.targets,
    tree: engineRead.tree,
    registry,
    resolveNodeTransform
  })
  const frameRead = createFrameRead({
    scope: frame
  })
  const toolRead = createToolRead({
    tool
  })

  return {
    document: engineRead.document,
    bounds,
    history,
    node: nodeRead,
    edge: edgeRead,
    frame: frameRead,
    mindmap: engineRead.mindmap,
    selection: selectionRead,
    tree: engineRead.tree,
    slice: engineRead.slice,
    index: engineRead.index,
    tool: toolRead,
    draw: {
      preferences: drawPreferences
    }
  }
}
