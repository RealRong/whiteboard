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
  finalize as finalizeEdit,
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
import { finalize } from '../selection/finalize'
import { createDrawRuntime } from '../draw'

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
  edit: ReturnType<typeof createEditState>
  container: ReturnType<typeof createContainerState>
  selection: ReturnType<typeof createSelectionState>
}

type InstanceInternals = {
  node: ReturnType<typeof createNodeFeatureRuntime>
  edge: ReturnType<typeof createEdgeFeatureRuntime>
  mindmap: ReturnType<typeof createMindmapFeatureRuntime>
  draw: ReturnType<typeof createDrawRuntime>
}

const createInstanceStores = ({
  engine,
  initialTool,
  interaction
}: {
  engine: EngineInstance
  initialTool: Tool
  interaction: InteractionCoordinator
}): {
  stores: InstanceStores
  state: WhiteboardInstance['state']
  read: WhiteboardInstance['read']
  internals: InstanceInternals
} => {
  const tool = createValueStore<Tool>(initialTool)
  const edit = createEditState()
  const container = createContainerState(engine.read)
  const selection = createSelectionState({
    read: engine.read
  })
  const node = createNodeFeatureRuntime()
  const edge = createEdgeFeatureRuntime()
  const mindmap = createMindmapFeatureRuntime()
  const draw = createDrawRuntime({
    getTool: () => tool.get()
  })
  const read = createRuntimeRead({
    engineRead: engine.read,
    tool,
    edit: edit.store,
    selection: selection.store,
    interaction: interaction.mode,
    node,
    edge,
    mindmap,
    draw
  })

  return {
    stores: {
      tool,
      edit,
      container,
      selection
    },
    state: {
      tool,
      edit: edit.store,
      selection: selection.store,
      container: container.store,
      interaction: interaction.mode
    },
    read,
    internals: {
      node,
      edge,
      mindmap,
      draw
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
  draw: ReturnType<typeof createDrawRuntime>['commands']
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
    interaction
  })

  const resetUiSessionState = () => {
    interaction.cancel()
    stores.edit.commands.clear()
    stores.selection.commands.clear()
    stores.container.commands.clear()
    internals.node.clear()
    internals.edge.clear()
    internals.mindmap.clear()
    internals.draw.clear()
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
      selection: stores.selection
    })
    finalizeEdit({
      read,
      container: stores.container,
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
    draw: internals.draw.commands
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
