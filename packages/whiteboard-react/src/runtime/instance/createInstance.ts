import { createValueStore } from '@whiteboard/core/runtime'
import type { EngineInstance } from '@whiteboard/engine'
import type {
  WhiteboardInstance,
  InternalInstance,
  Tool,
} from './types'
import { createState as createContainerState } from '../container'
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

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
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
  const container = createContainerState(engine.read)
  const selection = createSelectionState({
    read: engine.read
  })
  const node = createNodeFeatureRuntime()
  const edge = createEdgeFeatureRuntime()
  const mindmap = createMindmapFeatureRuntime()
  const read = createRuntimeRead({
    engineRead: engine.read,
    node,
    edge,
    mindmap
  })

  return {
    stores: {
      tool,
      container,
      selection
    },
    state: {
      tool,
      selection: selection.store,
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
  selection,
  container,
  viewport
}: {
  engine: EngineInstance
  tool: ReturnType<typeof createValueStore<Tool>>
  selection: SelectionCommands
  container: ReturnType<typeof createContainerState>
  viewport: ViewportCommands
}): WhiteboardInstance['commands'] => ({
  ...engine.commands,
  tool: {
    set: (nextTool) => {
      if (tool.get() === nextTool) return
      tool.set(nextTool)
    }
  },
  selection,
  container: container.commands,
  viewport,
  edge: engine.commands.edge
})

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
      selection: stores.selection
    })
  })

  const commands = createCommands({
    engine,
    tool: stores.tool,
    selection: stores.selection.commands,
    container: stores.container,
    viewport: viewport.commands
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
      if (stores.tool.get() !== config.tool) {
        stores.tool.set(config.tool)
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
