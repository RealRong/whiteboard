import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadFn,
  type ReadStore
} from '@whiteboard/engine'
import type { EdgeItem, NodeItem } from '@whiteboard/engine'
import type { EdgeId, NodeId, Node, Rect } from '@whiteboard/core/types'
import type { TargetBoundsInput } from '@whiteboard/core/node'
import type { NodeRegistry } from '../../types/node'
import {
  resolveNodeRole,
  resolveNodeTransform
} from './node'
import {
  isSelectionSnapshotEqual,
  resolveView,
  type SelectionSnapshot,
  type SelectionTarget
} from '../selection/state'

export type SelectionRead = ReadStore<SelectionSnapshot>

const trackSelectionBoundsDependencies = (
  readStore: ReadFn,
  source: SelectionTarget,
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>,
  tree: KeyedReadStore<NodeId, readonly NodeId[]>
) => {
  source.nodeIds.forEach((nodeId) => {
    const item = readStore(nodeItem, nodeId)
    if (!item || item.node.type !== 'group') {
      return
    }

    readStore(tree, nodeId).forEach((descendantId) => {
      readStore(nodeItem, descendantId)
    })
  })
}

export const createSelectionRead = ({
  source,
  nodeItem,
  edgeItem,
  bounds,
  tree,
  registry,
  resolveNodeTransform: readNodeTransform = resolveNodeTransform
}: {
  source: ReadStore<SelectionTarget>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  bounds: (input: TargetBoundsInput) => Rect | undefined
  tree: KeyedReadStore<NodeId, readonly NodeId[]>
  registry: NodeRegistry
  resolveNodeTransform?: typeof resolveNodeTransform
}): SelectionRead => {
  const getNodeRole = (node: Node) => resolveNodeRole(
    registry.get(node.type)
  )
  return createDerivedStore<SelectionSnapshot>({
    get: (readStore) => {
      const selectionSource = readStore(source)

      trackSelectionBoundsDependencies(
        readStore,
        selectionSource,
        nodeItem,
        tree
      )

      return resolveView({
        source: selectionSource,
        readNode: (nodeId) => readStore(nodeItem, nodeId),
        readEdge: (edgeId) => readStore(edgeItem, edgeId),
        readBounds: bounds,
        resolveNodeRole: getNodeRole,
        resolveNodeTransform: (node) => readNodeTransform(
          registry.get(node.type)
        )
      })
    },
    isEqual: isSelectionSnapshotEqual
  })
}
