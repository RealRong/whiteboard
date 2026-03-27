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
  isViewEqual,
  resolveView,
  type Source as SelectionSource,
  type View as SelectionView
} from '../selection/state'
import {
  readSelectionPressPlan,
  type SelectionPressContext,
  type SelectionPressPlan
} from '../selection/policy'

export type SelectionRead = ReadStore<SelectionView> & {
  press: (ctx: SelectionPressContext) => SelectionPressPlan | undefined
}

const trackSelectionBoundsDependencies = (
  readStore: ReadFn,
  source: SelectionSource,
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
  nodeFrame,
  nodeOwner,
  registry,
  resolveNodeTransform: readNodeTransform = resolveNodeTransform
}: {
  source: ReadStore<SelectionSource>
  nodeItem: KeyedReadStore<NodeId, Readonly<NodeItem> | undefined>
  edgeItem: KeyedReadStore<EdgeId, Readonly<EdgeItem> | undefined>
  bounds: (input: TargetBoundsInput) => Rect | undefined
  tree: KeyedReadStore<NodeId, readonly NodeId[]>
  nodeFrame: (nodeId: NodeId) => Rect | undefined
  nodeOwner: (nodeId: NodeId) => NodeId | undefined
  registry: NodeRegistry
  resolveNodeTransform?: typeof resolveNodeTransform
}): SelectionRead => {
  const getNodeRole = (node: Node) => resolveNodeRole(
    registry.get(node.type)
  )
  const store = createDerivedStore<SelectionView>({
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
    isEqual: isViewEqual
  })
  return Object.assign(store, {
    press: (ctx: SelectionPressContext) => readSelectionPressPlan({
      getNode: (nodeId) => nodeItem.get(nodeId)?.node,
      getOwnerId: nodeOwner,
      getNodeFrame: nodeFrame,
      getNodeRole
    }, ctx)
  })
}
