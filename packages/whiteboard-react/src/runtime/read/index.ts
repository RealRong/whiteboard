import type { EngineRead } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { NodeRegistry } from '../../types/node'
import type { NodeFeatureRuntime } from '../../features/node/session/node'
import type { EdgePreview } from '../../features/edge/preview'
import type { ReadStore } from '@whiteboard/core/runtime'
import type { Source as SelectionSource } from '../selection'
import type { Tool } from '../tool'
import {
  createNodeRead,
  createNodeItemRead,
  resolveNodeTransform,
  type NodeRead
} from './node'
import { createEdgeRead } from './edge'
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

export type RuntimeRead = Omit<EngineRead, 'node' | 'edge'> & {
  history: ReadStore<HistoryState>
  node: NodeRead
  edge: ReturnType<typeof createEdgeRead>
  selection: SelectionRead
  tool: ToolRead
  pick: PickRead
}

export const createRuntimeRead = ({
  engineRead,
  registry,
  tool,
  history,
  selection,
  pick,
  viewport,
  node,
  edge
}: {
  engineRead: EngineRead
  registry: NodeRegistry
  tool: ReadStore<Tool>
  history: ReadStore<HistoryState>
  selection: ReadStore<SelectionSource>
  pick: PickRuntime
  viewport: ViewportRead
  node: Pick<NodeFeatureRuntime, 'session'>
  edge: Pick<EdgePreview, 'patch'>
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
  const nodeRead: NodeRead = createNodeRead({
    read: engineRead,
    registry,
    item: nodeItem
  })
  const selectionRead = createSelectionRead({
    source: selection,
    nodeList: engineRead.node.list,
    nodeItem,
    edgeItem: edgeRead.item,
    edgeBounds: edgeRead.bounds,
    nodeBounds: nodeRead.bounds,
    nodeFrame: (nodeId) => {
      const item = nodeItem.get(nodeId)
      const entry = engineRead.index.node.get(nodeId)
      if (!item?.node || !entry) {
        return undefined
      }

      return {
        x: item.node.position.x,
        y: item.node.position.y,
        width: entry.rect.width,
        height: entry.rect.height
      }
    },
    registry,
    resolveNodeTransform
  })

  return {
    document: engineRead.document,
    canvas: engineRead.canvas,
    history,
    node: nodeRead,
    edge: edgeRead,
    mindmap: engineRead.mindmap,
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
