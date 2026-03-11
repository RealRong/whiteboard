import type { Instance as EngineInstance } from '@whiteboard/engine'
import type { DispatchResult } from '@whiteboard/core/types'
import type {
  InternalWhiteboardState,
  InternalWhiteboardInstance,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { createSelectionDomain } from '../../selection/domain'
import { createToolDomain } from './tool'
import { uiSignals } from './uiSignals'
import { interactionLock } from '../interaction/interactionLock'
import { nodeInteractionPreviewState } from '../../node/interaction/nodeInteractionPreviewState'
import { edgeConnectPreviewState } from '../../edge/interaction/connectPreviewState'
import { edgeRoutingPreviewState } from '../../edge/interaction/routingPreviewState'
import type { WhiteboardViewport } from '../../viewport'

export const createWhiteboardInstance = ({
  engine,
  uiStore,
  viewport
}: {
  engine: EngineInstance
  uiStore: InternalWhiteboardInstance['uiStore']
  viewport: WhiteboardViewport
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance

  const selection = createSelectionDomain({
    uiStore,
    readAllNodeIds: () => instance.read.node.ids()
  })
  const tool = createToolDomain({ uiStore })

  const state: InternalWhiteboardState = {
    tool: tool.state,
    selection: selection.state
  }

  const resetUiTransientState = () => {
    selection.commands.clear()
    interactionLock.forceReset(instance)
    nodeInteractionPreviewState.clearTransient(instance)
    edgeConnectPreviewState.reset(instance)
    edgeRoutingPreviewState.reset(instance)
    uiSignals.transientReset.emit(uiStore)
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

  instance = {
    engine,
    uiStore,
    state,
    config: engine.config,
    read: engine.read,
    commands: {
      ...engine.commands,
      document: {
        replace: async (doc) =>
          withUiReset(engine.commands.document.replace(doc))
      },
      tool: tool.commands,
      selection: selection.commands,
      edge
    },
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      tool.commands.set(config.tool)
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
