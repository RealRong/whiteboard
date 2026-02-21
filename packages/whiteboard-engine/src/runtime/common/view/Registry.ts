import type {
  InstanceConfig,
} from '@engine-types/instance/config'
import type {
  GraphChange,
  GraphProjector
} from '@engine-types/graph'
import type { Query } from '@engine-types/instance/query'
import type {
  State
} from '@engine-types/instance/state'
import type {
  View,
  ViewDebugSnapshot,
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { ShortcutContext } from '@engine-types/shortcuts'
import { createDerivedRegistry } from './DerivedRegistry'
import { ViewPipeline } from './ViewPipeline'
import { createEdgeRegistry, createEdgeViewQuery } from '../../actors/edge/view'
import { createMindmapRegistry } from '../../actors/mindmap/view'
import { createViewDerivations, VIEW_KEYS } from './Derivations'
import { createNodeRegistry } from '../../actors/node/view'
import type { ViewDependencyKey } from './register'

type Options = {
  state: State
  graph: GraphProjector
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
  syncQueryGraph?: (change: GraphChange) => void
}

export type ViewRuntime = {
  view: View
  syncGraph: (change: GraphChange) => void
}

export const createViewRegistry = ({
  state,
  graph,
  query,
  config,
  platform,
  syncQueryGraph
}: Options): ViewRuntime => {
  const edgeViewQuery = createEdgeViewQuery({
    readGraph: graph.read,
    query
  })
  const resolvers = createViewDerivations({
    readState: state.read,
    readGraph: graph.read,
    config,
    platform,
    edgeViewQuery
  })
  const derived = createDerivedRegistry<ViewKey, ViewDependencyKey, ViewSnapshot>({
    keys: VIEW_KEYS,
    resolvers
  })

  const node = createNodeRegistry({
    state,
    query,
    graph
  })
  const edge = createEdgeRegistry({
    readPaths: () => derived.read('edge.paths')
  })
  const mindmap = createMindmapRegistry({
    readTrees: () => derived.read('mindmap.trees')
  })

  const pipeline = new ViewPipeline({
    state,
    derived,
    query: syncQueryGraph
      ? { syncGraph: syncQueryGraph }
      : undefined,
    node,
    edge: {
      sync: edge.sync,
      syncGraph: edgeViewQuery.syncGraph
    },
    mindmap
  })
  pipeline.start()

  const getMetrics: View['debug']['getMetrics'] = (key) => {
    if (key === 'node.items') {
      return node.getNodeItemsMetric()
    }
    if (key === 'node.transformHandles') {
      return node.getNodeHandlesMetric()
    }
    return derived.debug.getMetric(key)
  }

  const getAllMetrics: View['debug']['getAllMetrics'] = () => {
    const metrics = derived.debug.getAllMetrics() as ViewDebugSnapshot
    metrics['node.items'] = node.getNodeItemsMetric()
    metrics['node.transformHandles'] = node.getNodeHandlesMetric()
    return metrics
  }

  const resetMetrics: View['debug']['resetMetrics'] = (key) => {
    if (key === 'node.items') {
      node.resetNodeItemsMetric()
      return
    }
    if (key === 'node.transformHandles') {
      node.resetNodeHandlesMetric()
      return
    }
    if (key) {
      derived.debug.resetMetrics(key)
      return
    }
    node.resetNodeItemsMetric()
    node.resetNodeHandlesMetric()
    derived.debug.resetMetrics()
  }

  return {
    view: {
      global: {
        viewportTransform: () => derived.read('viewport.transform'),
        watchViewportTransform: (listener) => derived.watch('viewport.transform', listener),
        shortcutContext: () => derived.read('shortcut.context'),
        watchShortcutContext: (listener) => derived.watch('shortcut.context', listener),
        edgePreview: () => derived.read('edge.preview'),
        watchEdgePreview: (listener) => derived.watch('edge.preview', listener),
        edgeSelectedEndpoints: () => derived.read('edge.selectedEndpoints'),
        watchEdgeSelectedEndpoints: (listener) => derived.watch('edge.selectedEndpoints', listener),
        edgeSelectedRouting: () => derived.read('edge.selectedRouting'),
        watchEdgeSelectedRouting: (listener) => derived.watch('edge.selectedRouting', listener),
        mindmapDrag: () => derived.read('mindmap.drag'),
        watchMindmapDrag: (listener) => derived.watch('mindmap.drag', listener)
      },
      node: {
        ids: node.getNodeIds,
        watchIds: node.watchNodeIds,
        item: node.getNodeItem,
        watchItem: node.watchNodeItem,
        handles: node.getNodeTransformHandles,
        watchHandles: node.watchNodeTransformHandles
      },
      edge: {
        ids: edge.getEdgeIds,
        watchIds: edge.watchEdgeIds,
        path: edge.getEdgePath,
        watchPath: edge.watchEdgePath
      },
      mindmap: {
        ids: mindmap.getMindmapTreeIds,
        watchIds: mindmap.watchMindmapTreeIds,
        tree: mindmap.getMindmapTree,
        watchTree: mindmap.watchMindmapTree
      },
      debug: {
        getMetrics,
        getAllMetrics,
        resetMetrics
      }
    },
    syncGraph: pipeline.syncGraph
  }
}
