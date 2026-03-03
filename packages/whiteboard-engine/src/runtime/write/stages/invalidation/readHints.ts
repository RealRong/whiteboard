import type {
  InvalidationMode,
  ReadInvalidation
} from '@engine-types/read/invalidation'
import type { MutationImpact } from '@engine-types/write/mutation'
import type { EdgeId, NodeId } from '@whiteboard/core/types'

const EMPTY_NODE_IDS: readonly NodeId[] = []
const EMPTY_EDGE_IDS: readonly EdgeId[] = []

const toMode = ({
  full,
  partial
}: {
  full: boolean
  partial: boolean
}): InvalidationMode => {
  if (full) return 'full'
  if (partial) return 'partial'
  return 'none'
}

export const createReadInvalidation = ({
  kind,
  revision,
  impact
}: {
  kind: 'apply' | 'replace'
  revision: number
  impact: MutationImpact
}): ReadInvalidation => {
  const dirtyNodeIds = impact.dirtyNodeIds ?? EMPTY_NODE_IDS
  const dirtyEdgeIds = impact.dirtyEdgeIds ?? EMPTY_EDGE_IDS
  const full = kind === 'replace' || impact.tags.has('full')
  const hasNodes = impact.tags.has('nodes')
  const hasEdges = impact.tags.has('edges')
  const hasOrder = impact.tags.has('order')
  const hasGeometry = impact.tags.has('geometry')
  const hasMindmap = impact.tags.has('mindmap')
  const hasViewport = impact.tags.has('viewport')
  const hasPartialSignal =
    hasNodes ||
    hasEdges ||
    hasOrder ||
    hasGeometry ||
    hasMindmap ||
    hasViewport ||
    dirtyNodeIds.length > 0 ||
    dirtyEdgeIds.length > 0

  const indexMode = toMode({
    full: full || (hasOrder && !hasEdges) || hasGeometry || hasMindmap,
    partial: !full && dirtyNodeIds.length > 0
  })
  const edgeRebuild = toMode({
    full:
      full ||
      hasEdges ||
      hasMindmap ||
      (hasGeometry && dirtyNodeIds.length === 0 && dirtyEdgeIds.length === 0),
    partial:
      !full &&
      (dirtyNodeIds.length > 0 || dirtyEdgeIds.length > 0)
  })

  return {
    mode: toMode({ full, partial: !full && hasPartialSignal }),
    revision: {
      from: Math.max(0, revision - 1),
      to: revision
    },
    dirtyNodeIds,
    dirtyEdgeIds,
    index: {
      mode: indexMode === 'partial' ? 'dirtyNodeIds' : indexMode,
      dirtyNodeIds
    },
    edge: {
      resetVisibleEdges: edgeRebuild === 'full',
      clearPendingDirtyNodeIds:
        full || edgeRebuild === 'full',
      appendDirtyNodeIds: dirtyNodeIds,
      appendDirtyEdgeIds: dirtyEdgeIds
    }
  }
}
