import type {
  InstanceConfig,
} from '@engine-types/instance/config'
import type {
  ProjectionChange,
  ProjectionStore
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  State,
  StateKey
} from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import {
  createEdgeViewDerivations,
  createEdgeViewQuery
} from '../actors/edge/view'
import { createMindmapViewDerivations } from '../actors/mindmap/view'
import { notifyListeners, watchSet } from './shared'
import { createViewportDomain } from './ViewportDomain'
import { createNodeDomain } from './NodeDomain'
import { createEdgeDomain } from './EdgeDomain'
import { createMindmapDomain } from './MindmapDomain'

type Options = {
  state: State
  projection: ProjectionStore
  query: Query
  config: InstanceConfig
}

export type ViewRuntime = {
  view: View
  applyProjection: (change: ProjectionChange) => void
}

type SyncAction = () => boolean

export const createViewRegistry = ({
  state,
  projection,
  query,
  config
}: Options): ViewRuntime => {
  const edgeViewQuery = createEdgeViewQuery({
    readProjection: projection.read,
    query
  })
  const edgeDerived = createEdgeViewDerivations({
    readState: state.read,
    edgeViewQuery
  })
  const mindmapDerived = createMindmapViewDerivations({
    readState: state.read,
    readProjection: projection.read,
    config
  })

  const viewport = createViewportDomain({ state })
  const node = createNodeDomain({
    state,
    query,
    projection
  })
  const edge = createEdgeDomain({
    derive: edgeDerived
  })
  const mindmap = createMindmapDomain({
    derive: mindmapDerived
  })

  const listeners = new Set<() => void>()

  const stateSyncActions: Partial<Record<StateKey, SyncAction>> = {
    viewport: () => {
      let changed = false
      changed = viewport.sync() || changed
      changed = node.syncState('viewport') || changed
      return changed
    },
    selection: () => node.syncState('selection'),
    groupHovered: () => node.syncState('groupHovered'),
    tool: () => {
      let changed = false
      changed = node.syncState('tool') || changed
      changed = edge.syncState('tool') || changed
      return changed
    },
    edgeConnect: () => edge.syncState('edgeConnect'),
    edgeSelection: () => edge.syncState('edgeSelection'),
    mindmapLayout: () => mindmap.syncState('mindmapLayout'),
    mindmapDrag: () => mindmap.syncState('mindmapDrag')
  }

  const handleStateChange = (key: StateKey) => {
    const action = stateSyncActions[key]
    if (!action) return
    const changed = action()
    if (!changed) return
    notifyListeners(listeners)
  }

  const runProjectionSync = (change: ProjectionChange) => {
    const fullSync = change.kind === 'full'
    const dirtyNodeIds = change.kind === 'partial' ? change.dirtyNodeIds : undefined
    const orderChanged = change.kind === 'partial' ? change.orderChanged : undefined
    const shouldSyncNodeCanvas =
      fullSync ||
      change.projection.canvasNodesChanged ||
      Boolean(dirtyNodeIds?.length) ||
      Boolean(orderChanged)

    let changed = false
    changed = edge.syncProjection({
      fullSync,
      canvasNodesChanged: change.projection.canvasNodesChanged,
      visibleEdgesChanged: change.projection.visibleEdgesChanged
    }) || changed
    changed = mindmap.syncProjection({
      fullSync,
      visibleNodesChanged: change.projection.visibleNodesChanged
    }) || changed
    if (shouldSyncNodeCanvas) {
      changed = node.syncGraph({
        dirtyNodeIds,
        orderChanged,
        fullSync
      }) || changed
    }
    return changed
  }

  const applyProjection = (change: ProjectionChange) => {
    edgeViewQuery.applyProjection(change)

    const changed = runProjectionSync(change)
    if (!changed) return
    notifyListeners(listeners)
  }

  state.watchChanges(handleStateChange)
  applyProjection({
    source: 'runtime',
    kind: 'full',
    projection: {
      visibleNodesChanged: true,
      canvasNodesChanged: true,
      visibleEdgesChanged: true
    }
  })

  const getState: View['getState'] = () => {
    return {
      viewport: {
        transform: viewport.getTransform()
      },
      nodes: node.getState(),
      edges: edge.getState(),
      mindmap: mindmap.getState()
    }
  }

  const subscribe: View['subscribe'] = (listener) => watchSet(listeners, listener)

  return {
    view: {
      getState,
      subscribe
    },
    applyProjection
  }
}
