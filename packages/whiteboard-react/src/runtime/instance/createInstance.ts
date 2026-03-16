import { createValueStore } from '@whiteboard/core/runtime'
import type { EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardInstance,
  WhiteboardRead,
  WhiteboardCommands,
  WhiteboardState,
  Tool,
  WhiteboardRuntimeOptions
} from './types'
import {
  createContainerStore,
  createSelectionStore,
  type WhiteboardSelectionCommands
} from '../state'
import type { WhiteboardViewport } from '../viewport'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction'
import { createNodeFeatureRuntime } from '../../features/node/session'
import { createEdgeFeatureRuntime } from '../../features/edge/session'
import { createMindmapFeatureRuntime } from '../../features/mindmap/session'
import { createSelectionBoxStore } from '../session/selectionBox'
import { createRuntimeRead } from '../read'

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
  container: ReturnType<typeof createContainerStore>
  selection: ReturnType<typeof createSelectionStore>
}

type InstanceInternals = {
  node: ReturnType<typeof createNodeFeatureRuntime>
  edge: ReturnType<typeof createEdgeFeatureRuntime>
  mindmap: ReturnType<typeof createMindmapFeatureRuntime>
  selectionBox: ReturnType<typeof createSelectionBoxStore>
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
  state: WhiteboardState
  read: WhiteboardRead
  internals: InstanceInternals
} => {
  const tool = createValueStore<Tool>(initialTool)
  const container = createContainerStore(engine.read)
  const selection = createSelectionStore({
    read: engine.read,
    container: container.store
  })
  const node = createNodeFeatureRuntime()
  const edge = createEdgeFeatureRuntime()
  const mindmap = createMindmapFeatureRuntime()
  const selectionBox = createSelectionBoxStore()
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
      mindmap,
      selectionBox
    }
  }
}

const createSelectionCommands = ({
  engine,
  selection,
  readContainer
}: {
  engine: EngineInstance
  selection: ReturnType<typeof createSelectionStore>
  readContainer: WhiteboardState['container']['get']
}): WhiteboardSelectionCommands => ({
  ...selection.commands,
  selectAll: () => {
    const container = readContainer()
    const nodeIds = container.id
      ? container.ids
      : engine.read.node.list.get()
    selection.commands.select(nodeIds)
  }
})

const createCommands = ({
  engine,
  tool,
  selection,
  container,
  withUiReset
}: {
  engine: EngineInstance
  tool: ReturnType<typeof createValueStore<Tool>>
  selection: WhiteboardSelectionCommands
  container: ReturnType<typeof createContainerStore>
  withUiReset: (effect: Promise<DispatchResult>) => Promise<DispatchResult>
}): WhiteboardCommands => ({
  ...engine.commands,
  document: {
    replace: async (doc) =>
      withUiReset(engine.commands.document.replace(doc))
  },
  tool: {
    set: (nextTool) => {
      if (tool.get() === nextTool) return
      tool.set(nextTool)
    }
  },
  selection,
  container: container.commands,
  edge: engine.commands.edge
})

export const createWhiteboardInstance = ({
  engine,
  initialTool,
  viewport,
  registry,
  interaction
}: {
  engine: EngineInstance
  initialTool: Tool
  viewport: WhiteboardViewport
  registry: NodeRegistry
  interaction: InteractionCoordinator
}): InternalWhiteboardInstance => {
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
    internals.selectionBox.clear()
  }

  const withUiReset = async (
    effect: Promise<DispatchResult>
  ) => {
    const result = await effect
    if (result.ok) {
      resetUiSessionState()
    }
    return result
  }

  const selectionCommands = createSelectionCommands({
    engine,
    selection: stores.selection,
    readContainer: state.container.get
  })
  const commands = createCommands({
    engine,
    tool: stores.tool,
    selection: selectionCommands,
    container: stores.container,
    withUiReset
  })

  return {
    engine,
    internals,
    interaction,
    registry,
    config: engine.config,
    read,
    state,
    commands,
    viewport,
    configure: (config: WhiteboardRuntimeOptions) => {
      if (stores.tool.get() !== config.tool) {
        stores.tool.set(config.tool)
      }
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      resetUiSessionState()
      engine.dispose()
    }
  }
}
