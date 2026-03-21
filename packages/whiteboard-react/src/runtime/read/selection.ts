import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadStore
} from '@whiteboard/core/runtime'
import type { EdgeItem, NodeItem } from '@whiteboard/core/read'
import type { EdgeId, NodeId } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import { resolveNodeTransformCapability } from '../../features/node/capability'
import {
  isViewEqual,
  resolveView,
  type Source as SelectionSource,
  type View as SelectionView
} from '../selection/state'

export type SelectionRead = ReadStore<SelectionView>

export const createSelectionRead = ({
  source,
  nodeItem,
  edgeItem,
  registry
}: {
  source: ReadStore<SelectionSource>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  registry: NodeRegistry
}): SelectionRead => createDerivedStore<SelectionView>({
  get: (readStore) => resolveView({
    source: readStore(source),
    readNode: (nodeId) => readStore(nodeItem, nodeId),
    readEdge: (edgeId) => readStore(edgeItem, edgeId),
    resolveNodeMeta: (type) => registry.get(type)?.meta,
    resolveNodeTransform: (node) => resolveNodeTransformCapability(
      registry.get(node.type)
    )
  }),
  isEqual: isViewEqual
})
