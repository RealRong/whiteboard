import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView,
  EdgesView
} from '@engine-types/instance/view'
import type { ProjectionCommit } from '@engine-types/projection'
import type { EdgeId } from '@whiteboard/core/types'
import { hasImpactTag } from '../mutation/Impact'
import {
  createIndexedState,
  updateIndexedState
} from './shared'

type EdgeDerivations = {
  paths: () => EdgePathEntry[]
  preview: () => EdgePreviewView
  selectedEndpoints: () => EdgeEndpoints | undefined
}

export type EdgeStateSyncKey =
  | 'selection'

type Options = {
  derive: EdgeDerivations
  applyCommit: (commit: ProjectionCommit) => void
}

export type EdgeDomain = {
  syncState: (key: EdgeStateSyncKey) => boolean
  applyCommit: (commit: ProjectionCommit) => boolean
  getState: () => EdgesView
}

export const createEdgeDomain = ({ derive, applyCommit }: Options): EdgeDomain => {
  let edgeIndex = createIndexedState<EdgeId, EdgePathEntry>(
    [],
    (entry) => entry.id
  )
  const edgePreview: EdgePreviewView = derive.preview()
  let edgeSelectedEndpoints: EdgeEndpoints | undefined = derive.selectedEndpoints()

  const recomputeEdgePaths = () => {
    const next = derive.paths()
    const result = updateIndexedState(edgeIndex, next, (entry) => entry.id)
    if (result.changed) {
      edgeIndex = result.state
    }
    return result.changed
  }

  const recomputeEdgeSelectedEndpoints = () => {
    const next = derive.selectedEndpoints()
    const changed = !Object.is(edgeSelectedEndpoints, next)
    edgeSelectedEndpoints = next
    return changed
  }

  const syncState = (key: EdgeStateSyncKey) => {
    if (key !== 'selection') return false
    return recomputeEdgeSelectedEndpoints()
  }

  const commitProjection = (commit: ProjectionCommit) => {
    applyCommit(commit)
    const impact = commit.impact
    const fullSync = commit.kind === 'replace' || hasImpactTag(impact, 'full')
    const canvasNodesChanged =
      hasImpactTag(impact, 'nodes') ||
      hasImpactTag(impact, 'geometry')
    const visibleEdgesChanged =
      hasImpactTag(impact, 'edges') ||
      hasImpactTag(impact, 'order') ||
      hasImpactTag(impact, 'mindmap')
    const shouldSyncEdgePaths =
      fullSync ||
      canvasNodesChanged ||
      visibleEdgesChanged
    const affectsEdgeNodes = fullSync || canvasNodesChanged
    const affectsEdgeVisibility = fullSync || visibleEdgesChanged

    let changed = false

    if (shouldSyncEdgePaths) {
      changed = recomputeEdgePaths() || changed
    }
    if (affectsEdgeNodes || affectsEdgeVisibility) {
      changed = recomputeEdgeSelectedEndpoints() || changed
    }

    return changed
  }

  const getState = (): EdgesView => ({
    ids: edgeIndex.ids,
    byId: edgeIndex.byId,
    preview: edgePreview,
    selection: {
      endpoints: edgeSelectedEndpoints
    }
  })

  return {
    syncState,
    applyCommit: commitProjection,
    getState
  }
}
