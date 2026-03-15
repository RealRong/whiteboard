import type { Instance as EngineInstance } from '@whiteboard/engine'
import type { ValueStore } from '@whiteboard/core/runtime'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardInstance,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { createContainerDomain } from '../state/container'
import { createScopeRead } from '../scope/read'
import { createSelectionDomain } from '../state/selection'
import type { EditorTool } from './toolState'
import { interactionLock } from '../interaction/interactionLock'
import type { WhiteboardViewport } from '../viewport'
import { createTransient } from '../draft'
import type { NodeRegistry } from '../../types/node'
import { createInteractionCoordinator } from '../interaction'
import { createWhiteboardView } from '../view'

export const createWhiteboardInstance = ({
  engine,
  toolState,
  viewport,
  registry,
  lockOwner
}: {
  engine: EngineInstance
  toolState: ValueStore<EditorTool>
  viewport: WhiteboardViewport
  registry: NodeRegistry
  lockOwner: object
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance
  const draft = createTransient()

  const selection = createSelectionDomain({
    readAllNodeIds: () => instance.read.node.ids()
  })
  const container = createContainerDomain()
  const interaction = createInteractionCoordinator()

  const resetUiTransientState = () => {
    interaction.clear()
    selection.commands.clear()
    container.commands.clear()
    interactionLock.forceReset(instance)
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
  const read = {
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
        if (toolState.get() === nextTool) return
        toolState.set(nextTool)
      }
    },
    selection: selection.commands,
    container: container.commands,
    edge
  }
  const view = createWhiteboardView({
    tool: toolState,
    scope: container.store,
    selection: selection.store,
    read,
    commands,
    draft,
    registry,
    interaction
  })

  instance = {
    engine,
    lockOwner,
    toolState,
    scopeState: container.store,
    selectionState: selection.store,
    draft,
    interaction,
    registry,
    config: engine.config,
    read,
    view,
    commands,
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      if (toolState.get() !== config.tool) {
        toolState.set(config.tool)
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
