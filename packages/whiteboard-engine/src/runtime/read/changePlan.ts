import type { NodeId } from '@whiteboard/core/types'
import type { Change } from '../write/pipeline/ChangeBus'
import { hasImpactTag } from '../write/mutation/Impact'

export type EdgeChangePlan = {
  bumpRevision: boolean
  resetVisibleEdges: boolean
  clearPendingDirtyNodeIds: boolean
  appendDirtyNodeIds: readonly NodeId[]
}

export type ReadIndexChangePlan = {
  mode: 'none' | 'full' | 'dirtyNodeIds'
  dirtyNodeIds: readonly NodeId[]
}

export type ReadChangePlan = {
  index: ReadIndexChangePlan
  edge: EdgeChangePlan
}

export const toReadChangePlan = (change: Change): ReadChangePlan => {
  const { impact } = change
  const dirtyNodeIds = impact.dirtyNodeIds ?? []
  const fullSync = change.kind === 'replace' || hasImpactTag(impact, 'full')
  const hasEdgesImpact = hasImpactTag(impact, 'edges')
  const hasOrderImpact = hasImpactTag(impact, 'order')
  const hasGeometryImpact = hasImpactTag(impact, 'geometry')
  const hasMindmapImpact = hasImpactTag(impact, 'mindmap')

  const indexMode: ReadIndexChangePlan['mode'] = (() => {
    if (fullSync) return 'full'
    if (hasOrderImpact && !hasEdgesImpact) return 'full'
    if (dirtyNodeIds.length) return 'dirtyNodeIds'
    if (hasGeometryImpact || hasMindmapImpact) return 'full'
    return 'none'
  })()

  const edgePlan: EdgeChangePlan = {
    bumpRevision:
      fullSync ||
      impact.tags.has('full') ||
      impact.tags.has('edges') ||
      impact.tags.has('mindmap') ||
      impact.tags.has('geometry') ||
      Boolean(dirtyNodeIds.length || impact.dirtyEdgeIds?.length),
    resetVisibleEdges:
      fullSync ||
      hasEdgesImpact ||
      hasMindmapImpact ||
      (hasGeometryImpact && !dirtyNodeIds.length),
    clearPendingDirtyNodeIds: fullSync,
    appendDirtyNodeIds: dirtyNodeIds
  }

  return {
    index: {
      mode: indexMode,
      dirtyNodeIds
    },
    edge: edgePlan
  }
}
