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
  ViewState,
  ViewportTransformView
} from '@engine-types/instance/view'
import type { EdgeId, NodeId, Viewport } from '@whiteboard/core'
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
  notifyListeners,
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

type SyncAction = () => void

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
  let edgePaths: EdgePathEntry[] = []
  let edgeIds: EdgeId[] = []
  let edgePathById = new Map<EdgeId, EdgePathEntry>()
  let edgePreview: EdgePreviewView = edgeDerived.preview()
  let edgeSelectedEndpoints: EdgeEndpoints | undefined = edgeDerived.selectedEndpoints()
  let edgeSelectedRouting: EdgeSelectedRoutingView = edgeDerived.selectedRouting()
  let mindmapTrees: MindmapViewTree[] = []
  let mindmapIds: NodeId[] = []
  let mindmapTreeById = new Map<NodeId, MindmapViewTree>()
  let mindmapDrag: MindmapDragView | undefined = mindmapDerived.drag()

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
    const changed = !Object.is(edgePaths, next)
    edgePaths = next
    if (changed) {
      edgeIds = next.map((entry) => entry.id)
      edgePathById = new Map<EdgeId, EdgePathEntry>()
      next.forEach((entry) => {
        edgePathById.set(entry.id, entry)
      })
    }
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
    const changed = !Object.is(mindmapTrees, next)
    mindmapTrees = next
    if (changed) {
      mindmapIds = next.map((entry) => entry.id)
      mindmapTreeById = new Map<NodeId, MindmapViewTree>()
      next.forEach((entry) => {
        mindmapTreeById.set(entry.id, entry)
      })
    }
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
      recomputeViewportTransform()
      syncState('viewport')
    },
    selection: () => {
      syncState('selection')
    },
    groupHovered: () => {
      syncState('groupHovered')
    },
    tool: () => {
      syncState('tool')
      recomputeEdgePreview()
    },
    edgeConnect: () => {
      recomputeEdgePaths()
      recomputeEdgePreview()
    },
    edgeSelection: () => {
      recomputeEdgeSelectedEndpoints()
      recomputeEdgeSelectedRouting()
    },
    mindmapLayout: () => {
      recomputeMindmapTrees()
    },
    mindmapDrag: () => {
      recomputeMindmapDrag()
    }
  }

  const handleStateChange = (key: StateKey) => {
    const action = stateSyncActions[key]
    if (!action) return
    action()
    notifyListeners(listeners)
  }

  const runGraphSync = (changeView: ReturnType<typeof toChangeView>) => {
    const {
      fullSync,
      dirtyNodeIds,
      orderChanged
    } = changeView
    const affectsEdgeNodes = fullSync || changeView.canvasNodesChanged
    const affectsEdgeVisibility = fullSync || changeView.visibleEdgesChanged

    if (shouldSyncDerivedEdgePaths(changeView)) {
      recomputeEdgePaths()
    }
    if (affectsEdgeNodes) {
      recomputeEdgePreview()
    }
    if (affectsEdgeNodes || affectsEdgeVisibility) {
      recomputeEdgeSelectedEndpoints()
    }
    if (affectsEdgeVisibility) {
      recomputeEdgeSelectedRouting()
    }
    if (shouldSyncDerivedMindmapTrees(changeView)) {
      recomputeMindmapTrees()
    }
    if (shouldSyncCanvasNodes(changeView)) {
      node.syncCanvasNodes({
        dirtyNodeIds,
        orderChanged,
        fullSync
      })
    }
  }

  const syncGraph = (change: GraphChange) => {
    syncQueryGraph?.(change)
    edgeViewQuery.syncGraph(change)

    const changeView = toChangeView(change)
    runGraphSync(changeView)

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
        ids: edgeIds,
        byId: edgePathById,
        preview: edgePreview,
        selection: {
          endpoints: edgeSelectedEndpoints,
          routing: edgeSelectedRouting
        }
      },
      mindmap: {
        ids: mindmapIds,
        byId: mindmapTreeById,
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
