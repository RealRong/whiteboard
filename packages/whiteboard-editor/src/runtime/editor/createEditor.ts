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
  createInteractionCoordinator,
  createSnapRuntime
} from '../interaction'
import type { InteractionCtx } from '../interaction/ctx'
import { createOverlay } from '../overlay'
import { createRead } from '../read'
import { createRuntimeState } from '../state'
import { composeInput } from './composeInput'
import { assembleInteractions } from './assembleInteractions'
import { createLifecycle } from './lifecycle'
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
    engine,
    registry,
    initialTool,
    initialViewport,
    viewportLimits,
    inputPolicy: initialInputPolicy,
    initialDrawPreferences
  })
  const interaction = createInteractionCoordinator({
    getViewport: () => runtime.state.viewport.input
  })
  const overlay = createOverlay({
    viewport: runtime.public.viewport
  })
  const read = createRead({
    engineRead: engine.read,
    registry,
    history: engine.history,
    runtime,
    overlay
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
  const commands = createEditorCommands({
    engine,
    read,
    runtime,
    overlay,
    insertPresetCatalog
  })
  const clipboard = createClipboard({
    editor: {
      commands,
      read,
      viewport: runtime.public.viewport
    }
  })

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
  const features = assembleInteractions(interactionCtx)

  const input = composeInput({
    read,
    viewport: runtime.public.viewport,
    interaction,
    policy: runtime.state.inputPolicy,
    pointer: runtime.state.pointer,
    interactions: features.interactions,
    passive: features.passive
  })

  const lifecycle = createLifecycle({
    engine,
    runtime,
    overlay,
    read,
    input,
    featureLifecycle: features.lifecycle
  })

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

  const editor = {
    interaction: {
      state: interactionState
    },
    registry,
    config: engine.config,
    read,
    state: runtime.public.state,
    commands,
    clipboard,
    input,
    viewport: runtime.public.viewport,
    feedback: features.feedback,
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
    dispose: lifecycle.dispose
  } satisfies Editor

  return editor
}
