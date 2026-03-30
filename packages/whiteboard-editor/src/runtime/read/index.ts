import type { FrameScope } from '@whiteboard/core/document'
import type { SelectionTarget } from '@whiteboard/core/selection'
import type { EngineRead, ReadStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/public/draw'
import type { NodeProjectionRuntime } from '../../features/node/projection/store'
import type { EdgeProjection } from '../../features/edge/projection'
import type { Tool } from '../tool'
import type {
  ContextMenuView,
  SelectionMenuView
} from '../context'
import {
  createNodeRead,
  createNodeInteractionRead,
  createNodeItemRead,
  resolveNodeTransform,
  type NodeRead
} from './node'
import { createBoundsRead } from './bounds'
import { createContextRead } from './context'
import {
  createEdgeRead,
  type EdgeRead
} from './edge'
import {
  createFrameRead,
  type FrameRead
} from './frame'
import {
  createPickRead,
  type PickRead
} from './pick'
import {
  createSelectionRead,
  type SelectionRead
} from './selection'
import { createToolRead, type ToolRead } from './tool'
import type { PickRuntime } from '../pick'
import type { ViewportRead } from '../viewport'

export type RuntimeRead = Omit<EngineRead, 'node' | 'edge' | 'bounds'> & {
  history: ReadStore<HistoryState>
  bounds: EngineRead['bounds']
  node: NodeRead
  edge: EdgeRead
  selection: SelectionRead
  tool: ToolRead
  pick: PickRead
  context: {
    menu: ReadStore<ContextMenuView | null>
    selection: ReadStore<SelectionMenuView | null>
  }
  frame: FrameRead
  draw: {
    preferences: ReadStore<DrawPreferences>
  }
}

export type RuntimeBaseRead = Omit<RuntimeRead, 'context'> & {
  context: Pick<RuntimeRead['context'], 'menu'>
}

export const createBaseRuntimeRead = ({
  engineRead,
  registry,
  tool,
  history,
  drawPreferences,
  selection,
  frame,
  contextMenu,
  pick,
  viewport,
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
  contextMenu: ReadStore<ContextMenuView | null>
  pick: PickRuntime
  viewport: ViewportRead
  node: Pick<NodeProjectionRuntime, 'store'>
  edge: Pick<EdgeProjection, 'patch'>
}): RuntimeBaseRead => {
  const nodeItem = createNodeItemRead({
    read: engineRead,
    projection: node.store
  })
  const nodeInteraction = createNodeInteractionRead({
    projection: node.store
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem,
    patch: edge.patch
  })
  const nodeRead: NodeRead = createNodeRead({
    read: engineRead,
    registry,
    item: nodeItem,
    interaction: nodeInteraction
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
  const pickRead = createPickRead({
    registry: pick,
    viewport
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
    context: {
      menu: contextMenu
    },
    frame: frameRead,
    mindmap: engineRead.mindmap,
    selection: selectionRead,
    tree: engineRead.tree,
    slice: engineRead.slice,
    pick: pickRead,
    index: engineRead.index,
    tool: toolRead,
    draw: {
      preferences: drawPreferences
    }
  }
}

export const createRuntimeRead = ({
  base,
  contextSelection
}: {
  base: RuntimeBaseRead
  contextSelection: ReadStore<SelectionMenuView | null>
}): RuntimeRead => ({
  ...base,
  context: createContextRead({
    menu: base.context.menu,
    selection: contextSelection
  })
})
