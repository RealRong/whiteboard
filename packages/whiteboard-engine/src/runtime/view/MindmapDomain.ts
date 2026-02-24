import type {
  MindmapDragView,
  MindmapView,
  MindmapViewTree
} from '@engine-types/instance/view'
import type { ProjectionChange } from '@engine-types/projection'
import type { NodeId } from '@whiteboard/core/types'
import {
  createIndexedState,
  updateIndexedState
} from './shared'

type MindmapDerivations = {
  trees: () => MindmapViewTree[]
  drag: () => MindmapDragView | undefined
}

export type MindmapStateSyncKey =
  | 'mindmapLayout'
  | 'mindmapDrag'

type Options = {
  derive: MindmapDerivations
}

export type MindmapDomain = {
  syncState: (key: MindmapStateSyncKey) => boolean
  syncProjection: (change: ProjectionChange) => boolean
  getState: () => MindmapView
}

export const createMindmapDomain = ({ derive }: Options): MindmapDomain => {
  let mindmapIndex = createIndexedState<NodeId, MindmapViewTree>(
    [],
    (entry) => entry.id
  )
  let mindmapDrag: MindmapDragView | undefined = derive.drag()

  const recomputeMindmapTrees = () => {
    const next = derive.trees()
    const result = updateIndexedState(mindmapIndex, next, (entry) => entry.id)
    if (result.changed) {
      mindmapIndex = result.state
    }
    return result.changed
  }

  const recomputeMindmapDrag = () => {
    const next = derive.drag()
    const changed = !Object.is(mindmapDrag, next)
    mindmapDrag = next
    return changed
  }

  const syncState = (key: MindmapStateSyncKey) =>
    key === 'mindmapLayout'
      ? recomputeMindmapTrees()
      : recomputeMindmapDrag()

  const syncProjection = (change: ProjectionChange) => {
    const fullSync = change.kind === 'full'
    const visibleNodesChanged = change.projection.visibleNodesChanged
    const shouldSyncTrees = fullSync || visibleNodesChanged
    if (!shouldSyncTrees) return false
    return recomputeMindmapTrees()
  }

  const getState = (): MindmapView => ({
    ids: mindmapIndex.ids,
    byId: mindmapIndex.byId,
    drag: mindmapDrag
  })

  return {
    syncState,
    syncProjection,
    getState
  }
}
