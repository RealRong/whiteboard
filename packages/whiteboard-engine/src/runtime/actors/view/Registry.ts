import type {
  InstanceConfig,
} from '@engine-types/instance/config'
import type {
  GraphChange,
  GraphProjector
} from '@engine-types/graph'
import type { Query } from '@engine-types/instance/query'
import type {
  State,
  StateKey
} from '@engine-types/instance/state'
import type {
  EdgeEndpoints,
  View,
  EdgePathEntry,
  EdgeSelectedRoutingView,
  EdgePreviewView,
  MindmapViewTree,
  MindmapDragView,
  NodeTransformHandle,
  NodeViewItem,
  ViewportTransformView
} from '@engine-types/instance/view'
import type { EdgeId, NodeId, Viewport } from '@whiteboard/core/types'
import {
  createEdgeViewDerivations,
  createEdgeViewQuery
} from '../edge/view'
import { createMindmapViewDerivations } from '../mindmap/view'
import { toChangeView } from '../graph/sync/ChangeView'
import {
  shouldSyncCanvasNodes,
  shouldSyncDerivedEdgePaths,
  shouldSyncDerivedMindmapTrees
} from '../graph/sync/Policy'
import { createNodeRegistry, type NodeStateSyncKey } from '../node/view'
import {
  createIndexedState,
  notifyListeners,
  updateIndexedState,
  watchSet
} from './shared'

type Options = {
  state: State
  graph: GraphProjector
  query: Query
  config: InstanceConfig
  syncQueryGraph?: (change: GraphChange) => void
}

export type ViewRuntime = {
  view: View
  syncGraph: (change: GraphChange) => void
}

type SyncAction = () => boolean

export const createViewRegistry = ({
  state,
  graph,
  query,
  config,
  syncQueryGraph
}: Options): ViewRuntime => {
  const toViewportTransformView = (viewport: Viewport): ViewportTransformView => {
    const zoom = viewport.zoom
    return {
      center: viewport.center,
      zoom,
      transform: `translate(50%, 50%) scale(${zoom}) translate(${-viewport.center.x}px, ${-viewport.center.y}px)`,
      cssVars: {
        '--wb-zoom': `${zoom}`
      }
    }
  }

  const edgeViewQuery = createEdgeViewQuery({
    readGraph: graph.read,
    query
  })
  const edgeDerived = createEdgeViewDerivations({
    readState: state.read,
    edgeViewQuery
  })
  const mindmapDerived = createMindmapViewDerivations({
    readState: state.read,
    readGraph: graph.read,
    config
  })

  const node = createNodeRegistry({
    state,
    query,
    graph
  })

  const listeners = new Set<() => void>()

  let viewportTransform: ViewportTransformView = toViewportTransformView(state.read('viewport'))
  let edgeIndex = createIndexedState<EdgeId, EdgePathEntry>(
    [],
    (entry) => entry.id
  )
  let edgePreview: EdgePreviewView = edgeDerived.preview()
  let edgeSelectedEndpoints: EdgeEndpoints | undefined = edgeDerived.selectedEndpoints()
  let edgeSelectedRouting: EdgeSelectedRoutingView = edgeDerived.selectedRouting()
  let mindmapIndex = createIndexedState<NodeId, MindmapViewTree>(
    [],
    (entry) => entry.id
  )
  let mindmapDrag: MindmapDragView | undefined = mindmapDerived.drag()

  type NodeViewRefs = {
    ids: NodeId[]
    itemsById: ReadonlyMap<NodeId, NodeViewItem>
    handlesById: ReadonlyMap<NodeId, readonly NodeTransformHandle[]>
  }

  const captureNodeRefs = (): NodeViewRefs => ({
    ids: node.getNodeIds(),
    itemsById: node.getNodeItemsMap(),
    handlesById: node.getNodeHandlesMap()
  })

  const hasNodeRefsChanged = (before: NodeViewRefs) =>
    before.ids !== node.getNodeIds()
    || before.itemsById !== node.getNodeItemsMap()
    || before.handlesById !== node.getNodeHandlesMap()

  const recomputeViewportTransform = () => {
    const next = toViewportTransformView(state.read('viewport'))
    const prev = viewportTransform
    const changed =
      prev.zoom !== next.zoom ||
      prev.center.x !== next.center.x ||
      prev.center.y !== next.center.y
    viewportTransform = next
    return changed
  }

  const recomputeEdgePaths = () => {
    const next = edgeDerived.paths()
    const result = updateIndexedState(edgeIndex, next, (entry) => entry.id)
    if (result.changed) {
      edgeIndex = result.state
    }
    const changed = result.changed
    return changed
  }

  const recomputeEdgePreview = () => {
    const next = edgeDerived.preview()
    const changed = !Object.is(edgePreview, next)
    edgePreview = next
    return changed
  }

  const recomputeEdgeSelectedEndpoints = () => {
    const next = edgeDerived.selectedEndpoints()
    const changed = !Object.is(edgeSelectedEndpoints, next)
    edgeSelectedEndpoints = next
    return changed
  }

  const recomputeEdgeSelectedRouting = () => {
    const next = edgeDerived.selectedRouting()
    const changed = !Object.is(edgeSelectedRouting, next)
    edgeSelectedRouting = next
    return changed
  }

  const recomputeMindmapTrees = () => {
    const next = mindmapDerived.trees()
    const result = updateIndexedState(mindmapIndex, next, (entry) => entry.id)
    if (result.changed) {
      mindmapIndex = result.state
    }
    const changed = result.changed
    return changed
  }

  const recomputeMindmapDrag = () => {
    const next = mindmapDerived.drag()
    const changed = !Object.is(mindmapDrag, next)
    mindmapDrag = next
    return changed
  }

  const syncState = (key: NodeStateSyncKey) => {
    node.syncState(key)
  }

  const stateSyncActions: Partial<Record<StateKey, SyncAction>> = {
    viewport: () => {
      const nodeBefore = captureNodeRefs()
      const changed = recomputeViewportTransform()
      syncState('viewport')
      return changed || hasNodeRefsChanged(nodeBefore)
    },
    selection: () => {
      const nodeBefore = captureNodeRefs()
      syncState('selection')
      return hasNodeRefsChanged(nodeBefore)
    },
    groupHovered: () => {
      const nodeBefore = captureNodeRefs()
      syncState('groupHovered')
      return hasNodeRefsChanged(nodeBefore)
    },
    tool: () => {
      const nodeBefore = captureNodeRefs()
      let changed = false
      syncState('tool')
      changed = recomputeEdgePreview() || changed
      return changed || hasNodeRefsChanged(nodeBefore)
    },
    edgeConnect: () => {
      let changed = false
      changed = recomputeEdgePaths() || changed
      changed = recomputeEdgePreview() || changed
      return changed
    },
    edgeSelection: () => {
      let changed = false
      changed = recomputeEdgeSelectedEndpoints() || changed
      changed = recomputeEdgeSelectedRouting() || changed
      return changed
    },
    mindmapLayout: () => {
      return recomputeMindmapTrees()
    },
    mindmapDrag: () => {
      return recomputeMindmapDrag()
    }
  }

  const handleStateChange = (key: StateKey) => {
    const action = stateSyncActions[key]
    if (!action) return
    const changed = action()
    if (!changed) return
    notifyListeners(listeners)
  }

  const runGraphSync = (changeView: ReturnType<typeof toChangeView>) => {
    const {
      fullSync,
      dirtyNodeIds,
      orderChanged
    } = changeView
    let changed = false
    const affectsEdgeNodes = fullSync || changeView.canvasNodesChanged
    const affectsEdgeVisibility = fullSync || changeView.visibleEdgesChanged

    if (shouldSyncDerivedEdgePaths(changeView)) {
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
    if (shouldSyncDerivedMindmapTrees(changeView)) {
      changed = recomputeMindmapTrees() || changed
    }
    if (shouldSyncCanvasNodes(changeView)) {
      const nodeBefore = captureNodeRefs()
      node.syncCanvasNodes({
        dirtyNodeIds,
        orderChanged,
        fullSync
      })
      changed = hasNodeRefsChanged(nodeBefore) || changed
    }
    return changed
  }

  const syncGraph = (change: GraphChange) => {
    syncQueryGraph?.(change)
    edgeViewQuery.syncGraph(change)

    const changeView = toChangeView(change)
    const changed = runGraphSync(changeView)
    if (!changed) return
    notifyListeners(listeners)
  }

  state.watchChanges(handleStateChange)
  recomputeEdgePaths()
  recomputeMindmapTrees()
  syncGraph({
    source: 'runtime',
    kind: 'full',
    projection: {
      visibleNodesChanged: true,
      canvasNodesChanged: true,
      visibleEdgesChanged: true
    }
  })

  const readNodeItems = () =>
    node.getNodeItemsMap() as ReadonlyMap<NodeId, NodeViewItem>

  const readNodeHandles = () =>
    node.getNodeHandlesMap() as ReadonlyMap<NodeId, readonly NodeTransformHandle[]>

  const getState: View['getState'] = () => {
    return {
      viewport: {
        transform: viewportTransform
      },
      nodes: {
        ids: node.getNodeIds(),
        byId: readNodeItems(),
        handlesById: readNodeHandles()
      },
      edges: {
        ids: edgeIndex.ids,
        byId: edgeIndex.byId,
        preview: edgePreview,
        selection: {
          endpoints: edgeSelectedEndpoints,
          routing: edgeSelectedRouting
        }
      },
      mindmap: {
        ids: mindmapIndex.ids,
        byId: mindmapIndex.byId,
        drag: mindmapDrag
      }
    }
  }

  const subscribe: View['subscribe'] = (listener) => watchSet(listeners, listener)

  return {
    view: {
      getState,
      subscribe
    },
    syncGraph
  }
}
