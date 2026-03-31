import type { SelectionTarget } from '@whiteboard/core/selection'
import type { EngineRead, ReadStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import { resolveNodeTransform } from '@whiteboard/core/node'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { EdgeTransientReader } from '../transient/edge'
import type { NodeTransientReader } from '../transient/node'
import type { Tool } from '../../types/tool'
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
  node,
  edge
}: {
  engineRead: EngineRead
  registry: NodeRegistry
  tool: ReadStore<Tool>
  history: ReadStore<HistoryState>
  drawPreferences: ReadStore<DrawPreferences>
  selection: ReadStore<SelectionTarget>
  node: NodeTransientReader
  edge: EdgeTransientReader
}): RuntimeRead => {
  const nodeItem = createNodeItemRead({
    read: engineRead,
    transient: node
  })
  const nodeInteraction = createNodeInteractionRead({
    transient: node
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
    transient: edge,
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
  const toolRead = createToolRead({
    tool
  })

  return {
    document: engineRead.document,
    bounds,
    frame: engineRead.frame,
    history,
    node: nodeRead,
    edge: edgeRead,
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
