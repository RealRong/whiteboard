import type {
  InstanceConfig,
} from '@engine-types/instance/config'
import type {
  ProjectionCommit,
  ProjectionStore
} from '@engine-types/projection'
import type { Query } from '@engine-types/instance/query'
import type {
  State,
  StateKey
} from '@engine-types/instance/state'
import type { View } from '@engine-types/instance/view'
import { FULL_MUTATION_IMPACT } from '../mutation/Impact'
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
}

export const createViewRegistry = ({
  state,
  projection,
  query,
  config
}: Options): ViewRuntime => {
  let snapshot = projection.getSnapshot()
  const readProjection = () => snapshot
  const createFullProjectionCommit = (): ProjectionCommit => ({
    revision: snapshot.revision,
    kind: 'replace',
    snapshot,
    impact: FULL_MUTATION_IMPACT
  })

  const edgeViewQuery = createEdgeViewQuery({
    readProjection,
    query
  })
  const edgeDerived = createEdgeViewDerivations({
    readState: state.read,
    edgeViewQuery
  })
  const mindmapDerived = createMindmapViewDerivations({
    readState: state.read,
    readProjection,
    config
  })

  const viewport = createViewportDomain({ state })
  const node = createNodeDomain({
    query,
    readProjection,
    readState: state.read
  })
  const edge = createEdgeDomain({
    derive: edgeDerived,
    applyCommit: edgeViewQuery.applyCommit
  })
  const mindmap = createMindmapDomain({
    derive: mindmapDerived
  })

  const listeners = new Set<() => void>()
  let dirtyWithoutListeners = true

  const syncStateAll = () => {
    viewport.sync()
    node.syncState('nodeTransform')
    edge.syncState('tool')
    edge.syncState('edgeConnect')
    edge.syncState('routingDrag')
    edge.syncState('selection')
    mindmap.syncState('mindmapLayout')
    mindmap.syncState('mindmapDrag')
  }

  const ensureViewSynced = () => {
    if (!dirtyWithoutListeners) return
    applyCommitToDomains(createFullProjectionCommit())
    syncStateAll()
    dirtyWithoutListeners = false
  }

  const handleStateChange = (key: StateKey) => {
    if (!listeners.size) {
      dirtyWithoutListeners = true
      return
    }
    let changed = false
    switch (key) {
      case 'viewport':
        changed = viewport.sync()
        break
      case 'tool':
        changed = edge.syncState('tool')
        break
      case 'nodeTransform':
        changed = node.syncState('nodeTransform')
        break
      case 'edgeConnect':
        changed = edge.syncState('edgeConnect')
        break
      case 'routingDrag':
        changed = edge.syncState('routingDrag')
        break
      case 'selection':
        changed = edge.syncState('selection')
        break
      case 'mindmapLayout':
        changed = mindmap.syncState('mindmapLayout')
        break
      case 'mindmapDrag':
        changed = mindmap.syncState('mindmapDrag')
        break
      default:
        return
    }
    if (!changed) return
    notifyListeners(listeners)
  }

  const applyCommitToDomains = (commit: ProjectionCommit) => {
    let changed = false
    changed = edge.applyCommit(commit) || changed
    changed = mindmap.applyCommit(commit) || changed
    changed = node.applyCommit(commit) || changed
    return changed
  }

  const applyCommit = (commit: ProjectionCommit) => {
    const changed = applyCommitToDomains(commit)
    if (!changed) return
    notifyListeners(listeners)
  }

  state.watchChanges(handleStateChange)
  projection.subscribe((commit) => {
    snapshot = commit.snapshot
    if (!listeners.size) {
      dirtyWithoutListeners = true
      return
    }
    applyCommit(commit)
  })

  const getState: View['getState'] = () => {
    ensureViewSynced()
    return {
      viewport: {
        transform: viewport.getTransform()
      },
      nodes: node.getState(),
      edges: edge.getState(),
      mindmap: mindmap.getState()
    }
  }

  const subscribe: View['subscribe'] = (listener) => {
    ensureViewSynced()
    return watchSet(listeners, listener)
  }

  return {
    view: {
      getState,
      subscribe
    }
  }
}
