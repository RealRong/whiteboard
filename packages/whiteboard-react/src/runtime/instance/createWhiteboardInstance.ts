import type { Instance as EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardInstance,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { createContainerDomain } from '../state/container'
import { createScopeRead } from '../scope/read'
import { createSelectionDomain } from '../state/selection'
import { toolAtom } from './toolState'
import { interactionLock } from '../interaction/interactionLock'
import type { WhiteboardViewport } from '../viewport'
import { createTransient } from '../draft'
import type { NodeRegistry } from '../../types/node'
import { createInteractionCoordinator } from '../interaction'
import { createWhiteboardView } from '../view'

export const createWhiteboardInstance = ({
  engine,
  uiStore,
  viewport,
  registry
}: {
  engine: EngineInstance
  uiStore: InternalWhiteboardInstance['uiStore']
  viewport: WhiteboardViewport
  registry: NodeRegistry
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance
  const draft = createTransient()

  const selection = createSelectionDomain({
    uiStore,
    readAllNodeIds: () => instance.read.node.ids()
  })
  const container = createContainerDomain({ uiStore })
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
      activeContainerId: container.read.activeId
    })
  }
  const view = createWhiteboardView(() => instance)

  instance = {
    engine,
    uiStore,
    draft,
    interaction,
    registry,
    config: engine.config,
    read,
    view,
    commands: {
      ...engine.commands,
      document: {
        replace: async (doc) =>
          withUiReset(engine.commands.document.replace(doc))
      },
      tool: {
        set: (nextTool) => {
          if (uiStore.get(toolAtom) === nextTool) return
          uiStore.set(toolAtom, nextTool)
        }
      },
      selection: selection.commands,
      container: container.commands,
      edge
    },
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      if (uiStore.get(toolAtom) !== config.tool) {
        uiStore.set(toolAtom, config.tool)
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
