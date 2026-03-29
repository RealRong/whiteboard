import { createValueStore, type ValueStore } from '@whiteboard/engine'
import type { HistoryState } from '@whiteboard/core/kernel'
import type { EngineInstance } from '@whiteboard/engine'
import type { Editor } from './types'
import type { Tool } from '../tool'
import { normalizeTool } from '../tool'
import {
  createState as createFrameState
} from '../frame'
import {
  createState as createEditState
} from '../edit'
import {
  createState as createSelectionState
} from '../selection'
import type { ViewportRead } from '../viewport'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction'
import { createPickRuntime, type PickRuntime } from '../pick'
import {
  createNodeFeatureRuntime,
  type NodeFeatureRuntime
} from '../../features/node/session/node'
import {
  createEdgePreview,
  type EdgePreview
} from '../../features/edge/preview'
import {
  createMindmapDragStore,
  type MindmapDragStore
} from '../../features/mindmap/session/drag'
import {
  createBaseRuntimeRead,
  type RuntimeBaseRead
} from '../read'
import type { ContextMenuView } from '../context'
import { createDrawState } from '../../features/draw/state'
import type {
  EditorInternals,
  EditorStores
} from '../../types/internal/editor'

export const createEditorStores = ({
  engine,
  initialTool,
  interaction,
  registry,
  contextMenu,
  pick,
  viewport
}: {
  engine: EngineInstance
  initialTool: Tool
  interaction: InteractionCoordinator
  registry: NodeRegistry
  contextMenu: ValueStore<ContextMenuView | null>
  pick: PickRuntime
  viewport: ViewportRead
}): {
  stores: EditorStores
  state: Editor['state']
  baseRead: RuntimeBaseRead
  internals: EditorInternals
} => {
  const tool = createValueStore<Tool>(normalizeTool(initialTool))
  const history = createValueStore(engine.commands.history.get())
  const draw = createDrawState()
  const edit = createEditState()
  const frame = createFrameState(engine.read)
  const selection = createSelectionState()
  const node = createNodeFeatureRuntime()
  const edge = {
    preview: createEdgePreview()
  }
  const mindmapDrag = createMindmapDragStore()
  const baseRead = createBaseRuntimeRead({
    engineRead: engine.read,
    registry,
    tool,
    history,
    selection: selection.source,
    frame: frame.store,
    contextMenu,
    pick,
    viewport,
    node,
    edge: edge.preview
  })

  return {
    stores: {
      tool,
      history,
      draw,
      edit,
      frame,
      selection
    },
    state: {
      tool,
      draw: draw.store,
      edit: edit.store,
      selection: selection.source,
      frame: frame.store,
      interaction: interaction.state
    },
    baseRead,
    internals: {
      pick,
      node,
      edge,
      mindmapDrag
    }
  }
}
