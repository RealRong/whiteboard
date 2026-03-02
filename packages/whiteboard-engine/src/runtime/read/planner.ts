import type { NodeId } from '@whiteboard/core/types'
import type { Change } from '@engine-types/write/change'
import { hasImpactTag } from '../write/impact'
import type {
  ChangePlan as ReadChangePlan,
  EdgeChange as EdgeChangePlan,
  IndexChange as ReadIndexChangePlan
} from '@engine-types/read/change'

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
