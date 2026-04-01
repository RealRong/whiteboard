import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { InsertPresetCatalog } from '../../types/insert'
import type { Tool } from '../../types/tool'
import type { Editor } from '../../types/editor'
import { createEditorCommands } from '../commands'
import { createOverlay } from '../overlay'
import { createRead } from '../read'
import { createRuntimeState } from '../state'
import { createClipboard } from '../clipboard'

export const createEditor = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  registry,
  insertPresetCatalog,
  initialDrawPreferences
}: {
  engine: EngineInstance
  initialTool: Tool
  initialViewport: Viewport
  viewportLimits: {
    minZoom: number
    maxZoom: number
  }
  registry: NodeRegistry
  insertPresetCatalog: InsertPresetCatalog
  initialDrawPreferences: DrawPreferences
}): Editor => {
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
  } satisfies Editor['commands']
  const state = runtime.public.state satisfies Editor['state']

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

  const editor = {
    read,
    state,
    commands,
    transient: overlay,
    configure: (config) => {
      commands.tool.set(config.tool)

      runtime.public.viewport.setLimits(config.viewport)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      unsubscribeCommit()
      resetRuntimeState()
      engine.dispose()
    }
  } satisfies Editor

  return editor
}
