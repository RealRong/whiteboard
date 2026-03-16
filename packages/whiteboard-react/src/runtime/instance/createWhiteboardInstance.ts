import { createValueStore } from '@whiteboard/core/runtime'
import type { EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardInstance,
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
import { createDrafts } from '../draft'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction'

type InstanceStores = {
  tool: ReturnType<typeof createValueStore<Tool>>
  container: ReturnType<typeof createContainerStore>
  selection: ReturnType<typeof createSelectionStore>
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
  draft: ReturnType<typeof createDrafts>
} => {
  const tool = createValueStore<Tool>(initialTool)
  const container = createContainerStore(engine.read)
  const selection = createSelectionStore({
    read: engine.read,
    container: container.store
  })
  const draft = createDrafts()

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
    draft
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
    draft
  } = createInstanceStores({
    engine,
    initialTool,
    interaction
  })

  const resetUiDraftState = () => {
    interaction.cancel()
    stores.selection.commands.clear()
    stores.container.commands.clear()
    draft.clear()
  }

  const withUiReset = async (
    effect: Promise<DispatchResult>
  ) => {
    const result = await effect
    if (result.ok) {
      resetUiDraftState()
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
    draft,
    interaction,
    registry,
    config: engine.config,
    read: engine.read,
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
      resetUiDraftState()
      engine.dispose()
    }
  }
}
