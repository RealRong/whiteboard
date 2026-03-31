import type { SelectionTarget } from '@whiteboard/core/selection'
import type { EngineRead, ReadStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { EdgeTransientReader } from '../transient/edge'
import type { NodeTransientReader } from '../transient/node'
import type { Tool } from '../../types/tool'
import {
  createNodeRead,
  type NodeRead
} from './node'
import {
  createEdgeRead,
  type EdgeRead
} from './edge'
import {
  createSelectionRead,
  type SelectionRead
} from './selection'
import { createToolRead, type ToolRead } from './tool'
import { createTargetBoundsQuery } from '../query/targetBounds'

export type RuntimeRead = Omit<EngineRead, 'node' | 'edge'> & {
  history: ReadStore<HistoryState>
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
  const nodeRead: NodeRead = createNodeRead({
    read: engineRead,
    registry,
    transient: node
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem: nodeRead.item,
    transient: edge,
    capability: nodeRead.capability
  })
  const targetBounds = createTargetBoundsQuery({
    node: nodeRead,
    edge: edgeRead
  })
  const selectionRead = createSelectionRead({
    source: selection,
    node: nodeRead,
    edge: edgeRead,
    targetBounds,
    registry
  })
  const toolRead = createToolRead({
    tool
  })

  return {
    document: engineRead.document,
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
