import {
  deriveSelectionSummary,
  isSelectionSummaryEqual,
  type SelectionSummary,
  type SelectionTarget
} from '@whiteboard/core/selection'
import { resolveNodeRole, resolveNodeTransform } from '@whiteboard/core/node'
import {
  createDerivedStore,
  type KeyedReadStore,
  type ReadFn,
  type ReadStore
} from '@whiteboard/engine'
import type { EdgeItem, NodeItem } from '@whiteboard/engine'
import type { Edge, EdgeId, Node, NodeId, Rect } from '@whiteboard/core/types'
import type { TargetBoundsInput } from '@whiteboard/core/node'
import type { NodeRegistry } from '../../types/node'

export type SelectionRead = ReadStore<SelectionSummary>

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
  return createDerivedStore<SelectionSummary>({
    get: (readStore) => {
      const selectionSource = readStore(source)

      trackSelectionBoundsDependencies(
        readStore,
        selectionSource,
        nodeItem,
        tree
      )

      return deriveSelectionSummary({
        target: selectionSource,
        nodes: selectionSource.nodeIds
          .map((nodeId) => readStore(nodeItem, nodeId)?.node)
          .filter((node): node is Node => Boolean(node)),
        edges: selectionSource.edgeIds
          .map((edgeId) => readStore(edgeItem, edgeId)?.edge)
          .filter((edge): edge is Edge => Boolean(edge)),
        readBounds: (target) => bounds({
          nodeIds: target.nodeIds,
          edgeIds: target.edgeIds,
          groups: 'content'
        }),
        isNodeScalable: (node) => (
          !node.locked
          && getNodeRole(node) !== 'frame'
        ),
        resolveNodeTransformCapability: (node) => readNodeTransform(
          registry.get(node.type)
        )
      })
    },
    isEqual: isSelectionSummaryEqual
  })
}
