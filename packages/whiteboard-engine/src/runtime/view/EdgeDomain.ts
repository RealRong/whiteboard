import type {
  EdgeEndpoints,
  EdgePathEntry,
  EdgePreviewView,
  EdgeSelectedRoutingView,
  EdgesView
} from '@engine-types/instance/view'
import type { EdgeId } from '@whiteboard/core/types'
import {
  createIndexedState,
  updateIndexedState
} from './shared'

type EdgeDerivations = {
  paths: () => EdgePathEntry[]
  preview: () => EdgePreviewView
  selectedEndpoints: () => EdgeEndpoints | undefined
  selectedRouting: () => EdgeSelectedRoutingView
}

export type EdgeStateSyncKey =
  | 'tool'
  | 'edgeConnect'
  | 'edgeSelection'

export type EdgeProjectionSyncInput = {
  fullSync: boolean
  canvasNodesChanged: boolean
  visibleEdgesChanged: boolean
}

type Options = {
  derive: EdgeDerivations
}

export type EdgeDomain = {
  syncState: (key: EdgeStateSyncKey) => boolean
  syncProjection: (input: EdgeProjectionSyncInput) => boolean
  getState: () => EdgesView
}

export const createEdgeDomain = ({ derive }: Options): EdgeDomain => {
  let edgeIndex = createIndexedState<EdgeId, EdgePathEntry>(
    [],
    (entry) => entry.id
  )
  let edgePreview: EdgePreviewView = derive.preview()
  let edgeSelectedEndpoints: EdgeEndpoints | undefined = derive.selectedEndpoints()
  let edgeSelectedRouting: EdgeSelectedRoutingView = derive.selectedRouting()

  const recomputeEdgePaths = () => {
    const next = derive.paths()
    const result = updateIndexedState(edgeIndex, next, (entry) => entry.id)
    if (result.changed) {
      edgeIndex = result.state
    }
    return result.changed
  }

  const recomputeEdgePreview = () => {
    const next = derive.preview()
    const changed = !Object.is(edgePreview, next)
    edgePreview = next
    return changed
  }

  const recomputeEdgeSelectedEndpoints = () => {
    const next = derive.selectedEndpoints()
    const changed = !Object.is(edgeSelectedEndpoints, next)
    edgeSelectedEndpoints = next
    return changed
  }

  const recomputeEdgeSelectedRouting = () => {
    const next = derive.selectedRouting()
    const changed = !Object.is(edgeSelectedRouting, next)
    edgeSelectedRouting = next
    return changed
  }

  const syncState = (key: EdgeStateSyncKey) => {
    if (key === 'tool') {
      return recomputeEdgePreview()
    }
    if (key === 'edgeConnect') {
      let changed = false
      changed = recomputeEdgePaths() || changed
      changed = recomputeEdgePreview() || changed
      return changed
    }
    let changed = false
    changed = recomputeEdgeSelectedEndpoints() || changed
    changed = recomputeEdgeSelectedRouting() || changed
    return changed
  }

  const syncProjection = ({
    fullSync,
    canvasNodesChanged,
    visibleEdgesChanged
  }: EdgeProjectionSyncInput) => {
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
    if (affectsEdgeNodes) {
      changed = recomputeEdgePreview() || changed
    }
    if (affectsEdgeNodes || affectsEdgeVisibility) {
      changed = recomputeEdgeSelectedEndpoints() || changed
    }
    if (affectsEdgeVisibility) {
      changed = recomputeEdgeSelectedRouting() || changed
    }

    return changed
  }

  const getState = (): EdgesView => ({
    ids: edgeIndex.ids,
    byId: edgeIndex.byId,
    preview: edgePreview,
    selection: {
      endpoints: edgeSelectedEndpoints,
      routing: edgeSelectedRouting
    }
  })

  return {
    syncState,
    syncProjection,
    getState
  }
}
