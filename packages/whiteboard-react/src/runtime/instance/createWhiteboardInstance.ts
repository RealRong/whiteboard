import { createValueStore } from '@whiteboard/core/runtime'
import type { Instance as EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  EditorTool,
  InternalWhiteboardInstance,
  WhiteboardRead,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { createContainerDomain } from '../state/container'
import { createScopeRead } from '../scope/read'
import { createSelectionDomain } from '../state/selection'
import type { WhiteboardViewport } from '../viewport'
import { createTransient } from '../draft'
import type { NodeRegistry } from '../../types/node'
import type { InteractionCoordinator } from '../interaction'
import { createWhiteboardView } from '../view'

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
  let instance!: InternalWhiteboardInstance
  const draft = createTransient()
  const tool = createValueStore<EditorTool>(initialTool)

  const selection = createSelectionDomain({
    readAllNodeIds: () => instance.read.node.ids.get()
  })
  const container = createContainerDomain()

  const resetUiTransientState = () => {
    interaction.cancel()
    selection.commands.clear()
    container.commands.clear()
    draft.clear()
  }

  const withUiReset = async (
    effect: Promise<DispatchResult>
  ) => {
    const result = await effect
    if (result.ok) {
      resetUiTransientState()
    }
    return result
  }

  const edge: WhiteboardCommands['edge'] = engine.commands.edge
  const read: WhiteboardRead = {
    ...engine.read,
    selection: selection.read,
    scope: createScopeRead({
      read: engine.read,
      activeId: container.store
    })
  }
  const commands: WhiteboardCommands = {
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
    selection: selection.commands,
    container: container.commands,
    edge
  }
  const view = createWhiteboardView({
    tool,
    scope: container.store,
    selection: selection.store,
    read
  })

  instance = {
    engine,
    draft,
    interaction,
    registry,
    config: engine.config,
    read,
    view,
    commands,
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      if (tool.get() !== config.tool) {
        tool.set(config.tool)
      }
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      resetUiTransientState()
      engine.dispose()
    }
  }

  return instance
}
