import type { NodeId } from '@whiteboard/core/types'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type {
  ChangePlan as ReadChangePlan,
  EdgeChange as EdgeChangePlan,
  IndexChange as ReadIndexChangePlan
} from '@engine-types/read/change'

export const toReadChangePlan = (
  invalidation: ReadInvalidation
): ReadChangePlan => {
  const dirtyNodeIds = invalidation.dirtyNodeIds as readonly NodeId[]
  const edgeInvalidation = invalidation.stages.projection.edge

  const indexMode: ReadIndexChangePlan['mode'] = (() => {
    if (invalidation.stages.index.nodeRectIndex === 'full') return 'full'
    if (invalidation.stages.index.nodeRectIndex === 'partial') return 'dirtyNodeIds'
    return 'none'
  })()

  const edgePlan: EdgeChangePlan = {
    resetVisibleEdges:
      edgeInvalidation.resetVisibleEdges ||
      edgeInvalidation.rebuild === 'full',
    clearPendingDirtyNodeIds:
      invalidation.mode === 'full' ||
      edgeInvalidation.rebuild === 'full',
    appendDirtyNodeIds:
      edgeInvalidation.dirtyNodeIds.length
        ? edgeInvalidation.dirtyNodeIds
        : dirtyNodeIds,
    appendDirtyEdgeIds: edgeInvalidation.dirtyEdgeIds
  }

  return {
    index: {
      mode: indexMode,
      dirtyNodeIds
    },
    edge: edgePlan
  }
}
