import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type { Rebuild } from '@engine-types/read/change'
import type { MutationImpact } from '@engine-types/write/mutation'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const toRebuild = ({
  full,
  dirty
}: {
  full: boolean
  dirty: boolean
}): Rebuild => {
  if (full) return 'full'
  if (dirty) return 'dirty'
  return 'none'
}

export const createReadInvalidation = ({
  impact
}: {
  impact: MutationImpact
}): ReadInvalidation => {
  const dirtyNodeIds = impact.dirtyNodeIds ?? EMPTY_NODE_IDS
  const dirtyEdgeIds = impact.dirtyEdgeIds ?? EMPTY_EDGE_IDS
  const full = impact.tags.has('full')
  const hasEdges = impact.tags.has('edges')
  const hasOrder = impact.tags.has('order')
  const hasGeometry = impact.tags.has('geometry')
  const hasMindmap = impact.tags.has('mindmap')

  const indexRebuild = toRebuild({
    full: full || (hasOrder && !hasEdges) || hasGeometry || hasMindmap,
    dirty: !full && dirtyNodeIds.length > 0
  })
  const edgeRebuild = toRebuild({
    full:
      full ||
      hasEdges ||
      hasMindmap ||
      (hasGeometry && dirtyNodeIds.length === 0 && dirtyEdgeIds.length === 0),
    dirty:
      !full &&
      (dirtyNodeIds.length > 0 || dirtyEdgeIds.length > 0)
  })

  return {
    index: {
      rebuild: indexRebuild,
      dirtyNodeIds
    },
    edge: {
      rebuild: edgeRebuild,
      dirtyNodeIds,
      dirtyEdgeIds
    }
  }
}
