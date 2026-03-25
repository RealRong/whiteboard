import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId, Rect } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import {
  resolveNodeScene,
  resolveNodeTransform
} from './node'
import {
  isViewEqual,
  resolveView,
  type Source as SelectionSource,
  type View as SelectionView
} from '../selection/state'

export type SelectionRead = ReadStore<SelectionView>

export const createSelectionRead = ({
  source,
  nodeList,
  nodeItem,
  edgeItem,
  edgeBounds,
  registry,
  resolveNodeTransform: readNodeTransform = resolveNodeTransform
}: {
  source: ReadStore<SelectionSource>
  nodeList: ReadStore<readonly NodeId[]>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  edgeBounds: (edgeId: EdgeId) => Rect | undefined
  registry: NodeRegistry
  resolveNodeTransform?: typeof resolveNodeTransform
}): SelectionRead => createDerivedStore<SelectionView>({
  get: (readStore) => resolveView({
    source: readStore(source),
    allNodeIds: readStore(nodeList),
    readNode: (nodeId) => readStore(nodeItem, nodeId),
    readEdge: (edgeId) => readStore(edgeItem, edgeId),
    readEdgeBounds: edgeBounds,
    resolveNodeScene: (node) => resolveNodeScene(
      registry.get(node.type)
    ),
    resolveNodeTransform: (node) => readNodeTransform(
      registry.get(node.type)
    )
  }),
  isEqual: isViewEqual
})
