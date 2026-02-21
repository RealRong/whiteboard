import type {
  ViewKey,
  ViewSnapshot
} from '@engine-types/instance/view'
import type { GraphSnapshot } from '@engine-types/graph'
import type { InstanceConfig } from '@engine-types/instance/config'
import type { State } from '@engine-types/instance/state'
import type { ShortcutContext } from '@engine-types/shortcuts'
import {
  EDGE_VIEW_DERIVATION_DEPS,
  createEdgeViewDerivations,
  type EdgeViewQuery
} from '../../actors/edge/view'
import {
  MINDMAP_VIEW_DERIVATION_DEPS,
  createMindmapViewDerivations
} from '../../actors/mindmap/view'
import {
  COMMON_VIEW_DERIVATION_DEPS,
  createCommonViewDerivations
} from './Derivation'
import {
  defineViewDerivation,
  type ViewDerivationMap
} from './register'

type Options = {
  readState: State['read']
  readGraph: () => GraphSnapshot
  config: InstanceConfig
  platform: ShortcutContext['platform']
  edgeViewQuery: EdgeViewQuery
}

const EMPTY_NODE_ITEMS: ViewSnapshot['node.items'] = []
const EMPTY_NODE_HANDLES: ViewSnapshot['node.transformHandles'] = new Map()

export const VIEW_KEYS: ViewKey[] = [
  'viewport.transform',
  'shortcut.context',
  'edge.paths',
  'edge.preview',
  'edge.selectedEndpoints',
  'edge.selectedRouting',
  'node.items',
  'node.transformHandles',
  'mindmap.roots',
  'mindmap.trees',
  'mindmap.drag'
]

export const createViewDerivations = ({
  readState,
  readGraph,
  config,
  platform,
  edgeViewQuery
}: Options): ViewDerivationMap => {
  const edge = createEdgeViewDerivations({
    readState,
    edgeViewQuery
  })
  const common = createCommonViewDerivations({
    readState,
    platform
  })
  const mindmap = createMindmapViewDerivations({
    readState,
    readGraph,
    config
  })

  return {
    'viewport.transform': defineViewDerivation(
      COMMON_VIEW_DERIVATION_DEPS.viewportTransform,
      common.viewportTransform
    ),
    'shortcut.context': defineViewDerivation(
      COMMON_VIEW_DERIVATION_DEPS.shortcutContext,
      common.shortcutContext
    ),
    'edge.paths': defineViewDerivation(EDGE_VIEW_DERIVATION_DEPS.paths, edge.paths),
    'edge.preview': defineViewDerivation(EDGE_VIEW_DERIVATION_DEPS.preview, edge.preview),
    'edge.selectedEndpoints': defineViewDerivation(
      EDGE_VIEW_DERIVATION_DEPS.selectedEndpoints,
      edge.selectedEndpoints
    ),
    'edge.selectedRouting': defineViewDerivation(
      EDGE_VIEW_DERIVATION_DEPS.selectedRouting,
      edge.selectedRouting
    ),
    'node.items': defineViewDerivation([], () => EMPTY_NODE_ITEMS),
    'node.transformHandles': defineViewDerivation([], () => EMPTY_NODE_HANDLES),
    'mindmap.roots': defineViewDerivation(MINDMAP_VIEW_DERIVATION_DEPS.roots, mindmap.roots),
    'mindmap.trees': defineViewDerivation(MINDMAP_VIEW_DERIVATION_DEPS.trees, mindmap.trees),
    'mindmap.drag': defineViewDerivation(MINDMAP_VIEW_DERIVATION_DEPS.drag, mindmap.drag)
  }
}
