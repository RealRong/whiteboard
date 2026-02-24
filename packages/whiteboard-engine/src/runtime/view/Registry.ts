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
}

export const createViewRegistry = ({
  state,
  projection,
  query,
  config
}: Options): ViewRuntime => {
  let snapshot = projection.get()
  const readProjection = () => snapshot

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
    readProjection
  })
  const edge = createEdgeDomain({
    derive: edgeDerived,
    applyProjection: edgeViewQuery.applyProjection
  })
  const mindmap = createMindmapDomain({
    derive: mindmapDerived
  })

  const listeners = new Set<() => void>()

  const handleStateChange = (key: StateKey) => {
    let changed = false
    switch (key) {
      case 'viewport':
        changed = viewport.sync()
        break
      case 'tool':
        changed = edge.syncState('tool')
        break
      case 'edgeConnect':
        changed = edge.syncState('edgeConnect')
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

  const runProjectionSync = (change: ProjectionChange) => {
    let changed = false
    changed = edge.syncProjection(change) || changed
    changed = mindmap.syncProjection(change) || changed
    changed = node.syncProjection(change) || changed
    return changed
  }

  const applyProjection = (change: ProjectionChange) => {
    const changed = runProjectionSync(change)
    if (!changed) return
    notifyListeners(listeners)
  }

  state.watchChanges(handleStateChange)
  projection.subscribe((commit) => {
    snapshot = commit.snapshot
    applyProjection(commit.change)
  })
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
    }
  }
}
