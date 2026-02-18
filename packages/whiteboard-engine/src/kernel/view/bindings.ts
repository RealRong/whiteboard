import type {
  ViewKey
} from '@engine-types/instance/view'
import type { State } from '@engine-types/instance/state'
import type { CanvasNodes } from '../projector/canvas'
import type { NodeRegistry } from './nodeRegistry'
import type { EdgeRegistry } from './edgeRegistry'
import type { MindmapRegistry } from './mindmapRegistry'

type Options = {
  state: State
  canvas: CanvasNodes
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
  canvas,
  derived,
  node,
  edge,
  mindmap
}: Options) => {
  const offCanvas = canvas.watch(({ dirtyNodeIds, orderChanged, fullSync }) => {
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
    offCanvas()
    offSelection()
    offGroupHovered()
    offTool()
    offViewport()
    offEdgePaths()
    offMindmapTrees()
  }
}
