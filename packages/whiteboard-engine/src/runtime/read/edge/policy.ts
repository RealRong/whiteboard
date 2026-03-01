import type { NodeId } from '@whiteboard/core/types'
import { hasImpactTag } from '../../write/mutation/Impact'
import type { Change } from '../../write/pipeline/ChangeBus'

export type EdgeChangePlan = {
  bumpRevision: boolean
  resetVisibleEdges: boolean
  clearPendingDirtyNodeIds: boolean
  appendDirtyNodeIds: readonly NodeId[]
}

export const toEdgeChangePlan = (change: Change): EdgeChangePlan => {
  const { impact } = change
  const dirtyNodeIds = impact.dirtyNodeIds ?? []
  const fullSync = change.kind === 'replace' || hasImpactTag(impact, 'full')
  const resetVisibleEdges =
    fullSync ||
    hasImpactTag(impact, 'edges') ||
    hasImpactTag(impact, 'mindmap') ||
    (hasImpactTag(impact, 'geometry') && !dirtyNodeIds.length)
  const bumpRevision =
    fullSync ||
    impact.tags.has('full') ||
    impact.tags.has('edges') ||
    impact.tags.has('mindmap') ||
    impact.tags.has('geometry') ||
    Boolean(dirtyNodeIds.length || impact.dirtyEdgeIds?.length)

  return {
    bumpRevision,
    resetVisibleEdges,
    clearPendingDirtyNodeIds: fullSync,
    appendDirtyNodeIds: dirtyNodeIds
  }
}
