import { createValueStore } from '@whiteboard/core/runtime'
import type { EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  EditorTool,
  InternalWhiteboardInstance,
  WhiteboardRead,
  WhiteboardCommands,
  WhiteboardRuntimeOptions
} from './types'
import { createContainerStore } from '../container/state'
import { createContainerRead } from '../container/read'
import { createSelectionStore } from '../state/selection'
import type { WhiteboardViewport } from '../viewport'
import { createDrafts } from '../draft'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction'
import { createWhiteboardView } from '../view'
import type { WhiteboardContainerRead } from '../container/read'
import type { WhiteboardSelectionCommands } from '../state/selection'

type InstanceState = {
  tool: ReturnType<typeof createValueStore<EditorTool>>
  container: ReturnType<typeof createContainerStore>
  selection: ReturnType<typeof createSelectionStore>
  draft: ReturnType<typeof createDrafts>
}

const createInstanceState = (
  initialTool: EditorTool
): InstanceState => ({
  tool: createValueStore<EditorTool>(initialTool),
  container: createContainerStore(),
  selection: createSelectionStore(),
  draft: createDrafts()
})

const createRead = ({
  engine,
  selection,
  container
}: {
  engine: EngineInstance
  selection: ReturnType<typeof createSelectionStore>
  container: WhiteboardContainerRead
}): WhiteboardRead => ({
  ...engine.read,
  selection: selection.read,
  container
})

const createSelectionCommands = ({
  engine,
  selection,
  container
}: {
  engine: EngineInstance
  selection: ReturnType<typeof createSelectionStore>
  container: WhiteboardContainerRead
}): WhiteboardSelectionCommands => ({
  ...selection.commands,
  selectAll: () => {
    const nodeIds = container.activeId()
      ? container.nodeIds()
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
  tool: ReturnType<typeof createValueStore<EditorTool>>
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
  initialTool: EditorTool
  viewport: WhiteboardViewport
  registry: NodeRegistry
  interaction: InteractionCoordinator
}): InternalWhiteboardInstance => {
  const state = createInstanceState(initialTool)
  const containerRead = createContainerRead({
    read: engine.read,
    activeId: state.container.store
  })

  const resetUiDraftState = () => {
    interaction.cancel()
    state.selection.commands.clear()
    state.container.commands.clear()
    state.draft.clear()
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

  const read = createRead({
    engine,
    selection: state.selection,
    container: containerRead
  })
  const selectionCommands = createSelectionCommands({
    engine,
    selection: state.selection,
    container: containerRead
  })
  const commands = createCommands({
    engine,
    tool: state.tool,
    selection: selectionCommands,
    container: state.container,
    withUiReset
  })
  const view = createWhiteboardView({
    tool: state.tool,
    container: state.container.store,
    selection: state.selection.store,
    read
  })

  return {
    engine,
    draft: state.draft,
    interaction,
    registry,
    config: engine.config,
    read,
    view,
    commands,
    viewport,
    configure: (config: WhiteboardRuntimeOptions) => {
      if (state.tool.get() !== config.tool) {
        state.tool.set(config.tool)
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
