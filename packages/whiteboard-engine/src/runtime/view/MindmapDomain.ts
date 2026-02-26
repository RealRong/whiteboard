import type {
  MindmapView,
  MindmapViewTree
} from '@engine-types/instance/view'
import type { ProjectionCommit } from '@engine-types/projection'
import type { NodeId } from '@whiteboard/core/types'
import { hasImpactTag } from '../mutation/Impact'
import {
  createIndexedState,
  updateIndexedState
} from './shared'

type MindmapDerivations = {
  trees: () => MindmapViewTree[]
}

export type MindmapStateSyncKey =
  | 'mindmapLayout'

type Options = {
  derive: MindmapDerivations
}

export type MindmapDomain = {
  syncState: (key: MindmapStateSyncKey) => boolean
  applyCommit: (commit: ProjectionCommit) => boolean
  getState: () => MindmapView
}

export const createMindmapDomain = ({ derive }: Options): MindmapDomain => {
  let mindmapIndex = createIndexedState<NodeId, MindmapViewTree>(
    [],
    (entry) => entry.id
  )

  const recomputeMindmapTrees = () => {
    const next = derive.trees()
    const result = updateIndexedState(mindmapIndex, next, (entry) => entry.id)
    if (result.changed) {
      mindmapIndex = result.state
    }
    return result.changed
  }

  const syncState = (_key: MindmapStateSyncKey) =>
    recomputeMindmapTrees()

  const applyCommit = (commit: ProjectionCommit) => {
    const impact = commit.impact
    const fullSync = commit.kind === 'replace' || hasImpactTag(impact, 'full')
    const shouldSyncTrees =
      fullSync ||
      hasImpactTag(impact, 'mindmap') ||
      hasImpactTag(impact, 'nodes')
    if (!shouldSyncTrees) return false
    return recomputeMindmapTrees()
  }

  const getState = (): MindmapView => ({
    ids: mindmapIndex.ids,
    byId: mindmapIndex.byId
  })

  return {
    syncState,
    applyCommit,
    getState
  }
}
