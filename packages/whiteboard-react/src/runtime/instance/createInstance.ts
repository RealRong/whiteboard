import { createValueStore } from '@whiteboard/core/runtime'
import type { EngineInstance } from '@whiteboard/engine'
import type {
  WhiteboardInstance,
  InternalInstance,
} from './types'
import type { Tool } from '../tool'
import {
  DEFAULT_EDGE_PRESET_KEY,
  DEFAULT_DRAW_PRESET_KEY,
  HandTool,
  SelectTool,
  createDrawTool,
  createEdgeTool,
  isSameTool,
  normalizeTool
} from '../tool'
import { createState as createContainerState } from '../container'
import {
  createState as createEditState,
  type Commands as EditCommands
} from '../edit'
import {
  createState as createSelectionState,
  type Commands as SelectionCommands
} from '../selection'
import type {
  ViewportCommands
} from '../viewport'
import { createViewport } from '../viewport/createViewport'
import type { NodeRegistry } from '../../types/node'
import {
  createInteractionCoordinator,
  type InteractionCoordinator
} from '../interaction'
import { createNodeFeatureRuntime } from '../../features/node/session/runtime'
import { createEdgeFeatureRuntime } from '../../features/edge/session/runtime'
import { createMindmapFeatureRuntime } from '../../features/mindmap/session/runtime'
import { createRuntimeRead } from '../read'
import type { Viewport } from '@whiteboard/core/types'
import { finalize } from '../finalize'
import { createDrawState } from '../../features/draw/state'

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
  draw: ReturnType<typeof createDrawState>
  edit: ReturnType<typeof createEditState>
  container: ReturnType<typeof createContainerState>
  selection: ReturnType<typeof createSelectionState>
}

type InstanceInternals = {
  node: ReturnType<typeof createNodeFeatureRuntime>
  edge: ReturnType<typeof createEdgeFeatureRuntime>
  mindmap: ReturnType<typeof createMindmapFeatureRuntime>
}

const createInstanceStores = ({
  engine,
  initialTool,
  interaction,
  registry
}: {
  engine: EngineInstance
  initialTool: Tool
  interaction: InteractionCoordinator
  registry: NodeRegistry
}): {
  stores: InstanceStores
  state: WhiteboardInstance['state']
  read: WhiteboardInstance['read']
  internals: InstanceInternals
} => {
  const tool = createValueStore<Tool>(initialTool)
  const draw = createDrawState()
  const edit = createEditState()
  const container = createContainerState(engine.read)
  const selection = createSelectionState()
  const node = createNodeFeatureRuntime()
  const edge = createEdgeFeatureRuntime()
  const mindmap = createMindmapFeatureRuntime()
  const read = createRuntimeRead({
    engineRead: engine.read,
    registry,
    tool,
    edit: edit.store,
    selection: selection.source,
    interaction: interaction.mode,
    node,
    edge,
    mindmap
  })

  return {
    stores: {
      tool,
      draw,
      edit,
      container,
      selection
    },
    state: {
      tool,
      draw: draw.store,
      edit: edit.store,
      selection: selection.source,
      container: container.store,
      interaction: interaction.mode
    },
    read,
    internals: {
      node,
      edge,
      mindmap
    }
  }
}

const createCommands = ({
  engine,
  tool,
  edit,
  selection,
  container,
  viewport,
  draw
}: {
  engine: EngineInstance
  tool: ReturnType<typeof createValueStore<Tool>>
  edit: EditCommands
  selection: SelectionCommands
  container: ReturnType<typeof createContainerState>
  viewport: ViewportCommands
  draw: ReturnType<typeof createDrawState>['commands']
}): WhiteboardInstance['commands'] => {
  const setTool = (nextTool: Tool) => {
    const normalized = normalizeTool(nextTool)
    if (isSameTool(tool.get(), normalized)) return
    tool.set(normalized)
  }

  return {
    ...engine.commands,
    tool: {
      set: setTool,
      select: () => {
        setTool(SelectTool)
      },
      hand: () => {
        setTool(HandTool)
      },
      edge: (preset = DEFAULT_EDGE_PRESET_KEY) => {
        setTool(createEdgeTool(preset))
      },
      insert: (preset) => {
        setTool({
          type: 'insert',
          preset
        })
      },
      draw: (preset = DEFAULT_DRAW_PRESET_KEY) => {
        setTool(createDrawTool(preset))
      }
    },
    draw,
    edit,
    selection: {
      replace: (nodeIds) => {
        edit.clear()
        selection.replace(nodeIds)
      },
      add: (nodeIds) => {
        edit.clear()
        selection.add(nodeIds)
      },
      remove: (nodeIds) => {
        edit.clear()
        selection.remove(nodeIds)
      },
      toggle: (nodeIds) => {
        edit.clear()
        selection.toggle(nodeIds)
      },
      selectEdge: (edgeId) => {
        edit.clear()
        selection.selectEdge(edgeId)
      },
      clear: () => {
        edit.clear()
        selection.clear()
      }
    },
    container: container.commands,
    viewport,
    edge: engine.commands.edge
  }
}

export const createInstance = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  registry,
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  registry: NodeRegistry
}): InternalInstance => {
  const viewport = createViewport({
    initialViewport,
    limits: viewportLimits
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => viewport.input
  })
  const {
    stores,
    state,
    read,
    internals
  } = createInstanceStores({
    engine,
    initialTool,
    interaction,
    registry
  })

  const resetUiSessionState = () => {
    interaction.cancel()
    stores.edit.commands.clear()
    stores.selection.commands.clear()
    stores.container.commands.clear()
    internals.node.clear()
    internals.edge.clear()
    internals.mindmap.clear()
  }
  const unsubscribeCommit = engine.commit.subscribe(() => {
    const commit = engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetUiSessionState()
      return
    }

    finalize({
      read,
      container: stores.container,
      selection: stores.selection,
      edit: stores.edit
    })
  })

  const commands = createCommands({
    engine,
    tool: stores.tool,
    edit: stores.edit.commands,
    selection: stores.selection.commands,
    container: stores.container,
    viewport: viewport.commands,
    draw: stores.draw.commands
  })

  return {
    engine,
    internals: {
      viewport,
      ...internals
    },
    interaction,
    registry,
    config: engine.config,
    read,
    state,
    commands,
    viewport: viewport.read,
    configure: (config) => {
      const nextTool = normalizeTool(config.tool)
      if (!isSameTool(stores.tool.get(), nextTool)) {
        stores.tool.set(nextTool)
      }
      viewport.setLimits(config.viewport)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      unsubscribeCommit()
      resetUiSessionState()
      engine.dispose()
    }
  }
}
