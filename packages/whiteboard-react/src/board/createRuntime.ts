import type { BoardConfig } from '@whiteboard/core/config'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { DrawPreferences } from '../features/draw/model'
import type { InsertPresetCatalog } from '../features/toolbox/model/insert'
import {
  createInteractionController
} from './dispatch/controller'
import { createOverlay } from './transient'
import type { InteractionInputPolicy } from './dispatch/ctx'
import type { NodeRegistry } from '../types/node'
import type { Tool } from '../tool'
import type { BoardRuntimeInternal } from './types'
import { createClipboard } from './engine/clipboard'
import { createEditorCommands } from './engine/commands'
import { createRead } from './engine/read'
import { createRuntimeState } from './local/state'

export const createRuntime = ({
  engine,
  boardConfig,
  initialTool,
  initialViewport,
  viewportLimits,
  registry,
  insertPresetCatalog,
  initialDrawPreferences,
  inputPolicy
}: {
  engine: EngineInstance
  boardConfig: BoardConfig
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  registry: NodeRegistry
  insertPresetCatalog: InsertPresetCatalog
  initialDrawPreferences: DrawPreferences
  inputPolicy: InteractionInputPolicy
}): BoardRuntimeInternal => {
  const runtime = createRuntimeState({
    initialTool,
    initialViewport,
    viewportLimits,
    initialDrawPreferences
  })
  const overlay = createOverlay({
    viewport: runtime.public.viewport
  })
  const read = createRead({
    engineRead: engine.read,
    registry,
    history: engine.history,
    runtime,
    overlay,
    viewport: runtime.public.viewport
  })
  const baseCommands = createEditorCommands({
    engine,
    read,
    runtime,
    overlay,
    insertPresetCatalog
  })
  const commands = {
    ...baseCommands,
    clipboard: createClipboard({
      editor: {
        commands: baseCommands,
        read,
        state: runtime.public.state
      }
    })
  } satisfies BoardRuntimeInternal['commands']
  const state = runtime.public.state satisfies BoardRuntimeInternal['state']
  const interaction = createInteractionController({
    editor: {
      read,
      state,
      commands,
      transient: overlay
    },
    engine,
    boardConfig,
    inputPolicy
  })

  const resetRuntimeState = () => {
    overlay.reset()
    runtime.resetLocal()
  }

  const unsubscribeCommit = engine.commit.subscribe(() => {
    const commit = engine.commit.get()
    if (!commit) {
      return
    }

    if (commit.kind === 'replace') {
      resetRuntimeState()
      return
    }

    runtime.reconcileAfterCommit(read)
  })

  const board = {
    read,
    state,
    commands,
    transient: overlay,
    interaction: {
      state: interaction.state
    },
    dispatch: interaction.dispatch,
    configure: (config) => {
      interaction.configure({
        panEnabled: config.viewport.enablePan,
        wheelEnabled: config.viewport.enableWheel,
        wheelSensitivity: config.viewport.wheelSensitivity
      })
      commands.tool.set(config.tool)
      runtime.public.viewport.setLimits(config.viewport)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      interaction.dispose()
      unsubscribeCommit()
      resetRuntimeState()
      engine.dispose()
    }
  } satisfies BoardRuntimeInternal

  return board
}
