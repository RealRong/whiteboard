import type {
  ViewKey
} from '@engine-types/instance/view'
import type { State } from '@engine-types/instance/state'
import type { GraphProjector } from '@engine-types/graph'
import type { NodeRegistry } from './nodeRegistry'
import type { EdgeRegistry } from './edgeRegistry'
import type { MindmapRegistry } from './mindmapRegistry'

type Options = {
  state: State
  graph: GraphProjector
  derived: {
    watch: (key: ViewKey, listener: () => void) => () => void
  }
  node: Pick<
    NodeRegistry,
    | 'syncCanvasNodes'
    | 'syncSelectionState'
    | 'syncGroupHoveredState'
    | 'syncToolState'
    | 'syncViewportState'
  >
  edge: Pick<EdgeRegistry, 'sync'>
  mindmap: Pick<MindmapRegistry, 'sync'>
}

export const bindViewSources = ({
  state,
  graph,
  derived,
  node,
  edge,
  mindmap
}: Options) => {
  const offGraph = graph.watch(({ dirtyNodeIds, orderChanged, fullSync, canvasNodesChanged }) => {
    if (!fullSync && !canvasNodesChanged && !dirtyNodeIds?.length && !orderChanged) {
      return
    }
    node.syncCanvasNodes({
      dirtyNodeIds,
      orderChanged,
      fullSync
    })
  })

  const offSelection = state.watch('selection', node.syncSelectionState)
  const offGroupHovered = state.watch('groupHovered', node.syncGroupHoveredState)
  const offTool = state.watch('tool', node.syncToolState)
  const offViewport = state.watch('viewport', node.syncViewportState)
  const offEdgePaths = derived.watch('edge.paths', edge.sync)
  const offMindmapTrees = derived.watch('mindmap.trees', mindmap.sync)

  node.syncCanvasNodes()
  edge.sync()
  mindmap.sync()

  return () => {
    offGraph()
    offSelection()
    offGroupHovered()
    offTool()
    offViewport()
    offEdgePaths()
    offMindmapTrees()
  }
}
