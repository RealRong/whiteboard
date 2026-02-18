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
import { createDerivedRegistry } from '../derive'
import { bindViewSources } from './bindings'
import { createViewDerivations, VIEW_KEYS } from './derivations'
import { createEdgeRegistry } from './edgeRegistry'
import { createMindmapRegistry } from './mindmapRegistry'
import { createNodeRegistry } from './nodeRegistry'
import type { ViewDependencyKey } from './register'

type Options = {
  state: State
  graph: GraphProjector
  query: Query
  config: InstanceConfig
  platform: ShortcutContext['platform']
}

const isGraphDependency = (key: ViewDependencyKey): key is Extract<ViewDependencyKey, `graph.${string}`> =>
  key.startsWith('graph.')

const shouldNotifyGraphDependency = (
  key: Extract<ViewDependencyKey, `graph.${string}`>,
  change: GraphChange
) => {
  if (change.fullSync) return true
  if (key === 'graph.visibleNodes') {
    return Boolean(change.visibleNodesChanged)
  }
  if (key === 'graph.canvasNodes') {
    return Boolean(change.canvasNodesChanged)
  }
  return Boolean(change.visibleEdgesChanged)
}

export const createViewRegistry = ({
  state,
  graph,
  query,
  config,
  platform
}: Options): View => {
  const resolvers = createViewDerivations({
    readState: state.read,
    readGraph: graph.read,
    query,
    config,
    platform
  })
  const derived = createDerivedRegistry<ViewKey, ViewDependencyKey, ViewSnapshot>({
    keys: VIEW_KEYS,
    resolvers,
    watchDependency: (key, listener) => {
      if (isGraphDependency(key)) {
        return graph.watch((change) => {
          if (!shouldNotifyGraphDependency(key, change)) return
          listener()
        })
      }
      return state.watch(key, listener)
    }
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

  bindViewSources({
    state,
    graph,
    derived,
    node,
    edge,
    mindmap
  })

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
  }
}
