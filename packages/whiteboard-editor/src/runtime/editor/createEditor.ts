import {
  createDerivedStore
} from '@whiteboard/engine'
import type { EngineInstance } from '@whiteboard/engine'
import type { Viewport } from '@whiteboard/core/types'
import type { NodeRegistry } from '../../types/node'
import type { DrawPreferences } from '../../types/draw'
import type { InsertPresetCatalog } from '../../types/insert'
import type { Tool } from '../../types/tool'
import type {
  Editor,
  EditorInteractionState
} from '../../types/editor'
import type { EditorInputPolicy } from './types'
import { createEditorCommands } from '../commands'
import {
  createInteractionRuntime,
  createSnapRuntime
} from '../interaction'
import type { InteractionCtx } from '../interaction/ctx'
import type { InteractionOwner } from '../../types/runtime/interaction'
import { createDrawInteraction } from '../../interactions/draw'
import { createEdgeInteraction } from '../../interactions/edge'
import { createInsertInteraction } from '../../interactions/insert'
import { createMindmapInteraction } from '../../interactions/mindmap'
import { createSelectionInteraction } from '../../interactions/selection'
import { createTransformInteraction } from '../../interactions/transform'
import { createViewportInteraction } from '../../interactions/viewport'
import { createOverlay } from '../overlay'
import { createRead } from '../read'
import { createRuntimeState } from '../state'
import { createClipboard } from '../clipboard'

export const createEditor = ({
  engine,
  initialTool,
  initialViewport,
  viewportLimits,
  inputPolicy: initialInputPolicy,
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
  inputPolicy: EditorInputPolicy
  registry: NodeRegistry
  insertPresetCatalog: InsertPresetCatalog
  initialDrawPreferences: DrawPreferences
}): Editor => {
  const runtime = createRuntimeState({
    initialTool,
    initialViewport,
    viewportLimits,
    inputPolicy: initialInputPolicy,
    initialDrawPreferences
  })
  let owners: readonly InteractionOwner[] = []
  const interaction = createInteractionRuntime({
    getViewport: () => runtime.state.viewport.input,
    getOwners: () => owners
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
  const snap = createSnapRuntime({
    readZoom: () => runtime.public.viewport.get().zoom,
    node: {
      config: engine.config.node,
      query: engine.read.index.snap.inRect
    },
    edge: {
      config: engine.config.edge,
      nodeSize: engine.config.nodeSize,
      query: read.edge.connectCandidates
    }
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

  const interactionState = createDerivedStore<EditorInteractionState>({
    get: (readStore) => {
      const state = readStore(interaction.state)
      const mode = readStore(interaction.mode)

      return {
        busy: state.busy,
        chrome: state.chrome,
        transforming: state.transforming,
        drawing: mode === 'draw',
        panning: mode === 'viewport-pan',
        selecting:
          mode === 'press'
          || mode === 'marquee'
          || mode === 'node-drag'
          || mode === 'mindmap-drag'
          || mode === 'node-transform',
        editingEdge:
          mode === 'edge-drag'
          || mode === 'edge-connect'
          || mode === 'edge-route',
        space: state.space
      }
    },
    isEqual: (left, right) => (
      left.busy === right.busy
      && left.chrome === right.chrome
      && left.transforming === right.transforming
      && left.drawing === right.drawing
      && left.panning === right.panning
      && left.selecting === right.selecting
      && left.editingEdge === right.editingEdge
      && left.space === right.space
    )
  })
  const state = {
    ...runtime.public.state,
    interaction: interactionState
  } satisfies Editor['state']

  const interactionCtx: InteractionCtx = {
    read,
    state: runtime.state,
    config: engine.config,
    registry,
    interaction: {
      mode: interaction.mode,
      state: interaction.state
    },
    commands,
    overlay,
    snap
  }
  const viewportInteraction = createViewportInteraction(interactionCtx)
  const insertInteraction = createInsertInteraction(interactionCtx)
  const drawInteraction = createDrawInteraction(interactionCtx)
  const transformInteraction = createTransformInteraction(interactionCtx)
  const mindmapInteraction = createMindmapInteraction(interactionCtx)
  const selectionInteraction = createSelectionInteraction(interactionCtx)
  const edgeInteraction = createEdgeInteraction(interactionCtx)

  owners = [
    viewportInteraction,
    insertInteraction,
    drawInteraction.owner,
    transformInteraction.owner,
    mindmapInteraction.owner,
    selectionInteraction.owner,
    edgeInteraction.owner
  ]

  const clearInteractions = () => {
    drawInteraction.clear()
    transformInteraction.clear()
    mindmapInteraction.clear()
    selectionInteraction.clear()
    edgeInteraction.clear()
  }

  const writePointer = (input: {
    client: { x: number, y: number }
    screen: { x: number, y: number }
    world: { x: number, y: number }
  }) => {
    runtime.state.pointer.set({
      client: input.client,
      screen: input.screen,
      world: input.world
    })
  }

  const clearPointer = () => {
    runtime.state.pointer.set(null)
  }

  const input: Editor['input'] = {
    cancel: () => {
      clearPointer()
      interaction.cancel()
    },
    pointerDown: (input) => {
      writePointer(input)

      const handled = interaction.handlePointerDown(input)
      return {
        handled,
        continuePointer: handled && interaction.busy.get()
      }
    },
    pointerMove: (input) => {
      writePointer(input)
      return interaction.handlePointerMove(input)
    },
    pointerUp: (input) => {
      writePointer(input)
      return interaction.handlePointerUp(input)
    },
    pointerCancel: (input) => {
      clearPointer()
      return interaction.handlePointerCancel(input)
    },
    pointerLeave: () => {
      clearPointer()
      interaction.handlePointerLeave()
    },
    wheel: (input) => {
      const policy = runtime.state.inputPolicy.get()
      if (!policy.wheelEnabled) {
        return false
      }

      writePointer(input)

      if (interaction.handleWheel(input)) {
        return true
      }

      runtime.public.viewport.input.wheel(
        {
          deltaX: input.deltaX,
          deltaY: input.deltaY,
          ctrlKey: input.modifiers.ctrl,
          metaKey: input.modifiers.meta,
          clientX: input.client.x,
          clientY: input.client.y
        },
        policy.wheelSensitivity
      )
      return true
    },
    keyDown: (input) => interaction.handleKeyDown(input),
    keyUp: (input) => interaction.handleKeyUp(input),
    blur: () => {
      clearPointer()
      interaction.handleBlur()
    }
  }

  const resetRuntimeState = () => {
    input.cancel()
    overlay.reset()
    runtime.resetLocal()
    clearInteractions()
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
    input,
    configure: (config) => {
      commands.tool.set(config.tool)

      runtime.public.viewport.setLimits(config.viewport)
      runtime.state.inputPolicy.set({
        panEnabled: config.viewport.enablePan,
        wheelEnabled: config.viewport.enableWheel,
        wheelSensitivity: config.viewport.wheelSensitivity
      })
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
