import type { EngineRead } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { NodeRegistry } from '../../types/node'
import type { NodeFeatureRuntime } from '../../features/node/session/runtime'
import type { EdgePreview } from '../../features/edge/preview'
import type { MindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { Source as SelectionSource } from '../selection'
import type { Tool } from '../tool'
import type { EditTarget } from '../edit'
import type { InteractionMode } from '../interaction'
import {
  createNodeRead,
  createNodeItemRead,
  resolveNodeTransform,
  type NodeRead
} from './node'
import {
  createChromeRead,
  type ChromeRead
} from './chrome'
import { createEdgeRead } from './edge'
import { createMindmapRead } from './mindmap'
import { createToolRead, type ToolRead } from './tool'
import {
  createSelectionRead,
  type SelectionRead
} from './selection'
import {
  createPickRead,
  type PickRead
} from './pick'
import type { PickRuntime } from '../pick'
import type { ViewportRead } from '../viewport'

export type RuntimeRead = Omit<EngineRead, 'node'> & {
  history: ReadStore<HistoryState>
  node: NodeRead
  chrome: ChromeRead
  selection: SelectionRead
  tool: ToolRead
  pick: PickRead
}

export const createRuntimeRead = ({
  engineRead,
  registry,
  tool,
  edit,
  history,
  selection,
  interaction,
  pick,
  viewport,
  node,
  edge,
  mindmap
}: {
  engineRead: EngineRead
  registry: NodeRegistry
  tool: ReadStore<Tool>
  edit: ReadStore<EditTarget>
  history: ReadStore<HistoryState>
  selection: ReadStore<SelectionSource>
  interaction: ReadStore<InteractionMode>
  pick: PickRuntime
  viewport: ViewportRead
  node: Pick<NodeFeatureRuntime, 'session' | 'chromeHidden'>
  edge: Pick<EdgePreview, 'patch'>
  mindmap: Pick<MindmapFeatureRuntime, 'drag'>
}): RuntimeRead => {
  const nodeItem = createNodeItemRead({
    read: engineRead,
    session: node.session
  })
  const edgeRead = createEdgeRead({
    read: engineRead,
    nodeItem,
    patch: edge.patch
  })
  const selectionRead = createSelectionRead({
    source: selection,
    nodeItem,
    edgeItem: edgeRead.item,
    registry,
    resolveNodeTransform
  })
  const nodeRead: NodeRead = createNodeRead({
    read: engineRead,
    registry,
    item: nodeItem
  })
  const chromeRead = createChromeRead({
    tool,
    edit,
    selection: selectionRead,
    interaction,
    chromeHidden: node.chromeHidden
  })
  const mindmapRead = createMindmapRead({
    read: engineRead,
    session: mindmap.drag
  })

  return {
    document: engineRead.document,
    canvas: engineRead.canvas,
    history,
    node: nodeRead,
    chrome: chromeRead,
    edge: edgeRead,
    mindmap: mindmapRead,
    selection: selectionRead,
    tree: engineRead.tree,
    slice: engineRead.slice,
    pick: createPickRead({
      registry: pick,
      viewport
    }),
    index: engineRead.index,
    tool: createToolRead({
      tool
    })
  }
}
