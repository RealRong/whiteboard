import {
  deriveSelectionSummary,
  isSelectionSummaryEqual,
  resolveSelectionBoxTarget,
  type SelectionSummary,
  type SelectionTarget
} from '@whiteboard/core/selection'
import {
  createDerivedStore,
  type ReadFn,
  type ReadStore
} from '@whiteboard/engine'
import type { Edge, Node } from '@whiteboard/core/types'
import type { EdgeRead } from './edge'
import type { NodeRead } from './node'
import type { TargetBoundsQuery } from '../query/targetBounds'

export type SelectionRead = {
  target: ReadStore<SelectionTarget>
  summary: ReadStore<SelectionSummary>
}

const readRuntimeNodes = (
  node: Pick<NodeRead, 'item' | 'list'>,
  readStore: ReadFn
) => readStore(node.list)
  .map((nodeId) => readStore(node.item, nodeId)?.node)
  .filter((entry): entry is Node => Boolean(entry))

export const createSelectionRead = ({
  source,
  node,
  edge,
  targetBounds
}: {
  source: ReadStore<SelectionTarget>
  node: NodeRead
  edge: EdgeRead
  targetBounds: TargetBoundsQuery
}): SelectionRead => ({
  target: source,
  summary: createDerivedStore<SelectionSummary>({
    get: (readStore) => {
      const selectionTarget = readStore(source)
      const runtimeNodes = readRuntimeNodes(node, readStore)
      const nodes = selectionTarget.nodeIds
        .map((nodeId) => readStore(node.item, nodeId)?.node)
        .filter((entry): entry is Node => Boolean(entry))
      const edges = selectionTarget.edgeIds
        .map((edgeId) => readStore(edge.item, edgeId)?.edge)
        .filter((entry): entry is Edge => Boolean(entry))

      return deriveSelectionSummary({
        target: selectionTarget,
        nodes,
        edges,
        readBounds: (target) => targetBounds.track(
          readStore,
          resolveSelectionBoxTarget(target, runtimeNodes)
        ),
        isNodeScalable: (entry) => (
          !entry.locked
          && node.capability(entry).role !== 'frame'
        ),
        resolveNodeTransformCapability: (entry) => {
          const capability = node.capability(entry)

          return {
            resize: capability.resize,
            rotate: capability.rotate
          }
        }
      })
    },
    isEqual: isSelectionSummaryEqual
  })
})
