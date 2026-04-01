import {
  createDerivedStore,
  createValueStore,
  type EngineInstance
} from '@whiteboard/engine'
import type {
  Editor as BaseEditorRuntime,
  EditorInput,
  EditorInteractionState
} from '@whiteboard/editor'
import type { BoardConfig } from '@whiteboard/core/config'
import type { WhiteboardRuntime } from '../types/runtime'
import {
  createInteractionRuntime,
  createSnapRuntime,
  type InteractionCtx,
  type InteractionFeature,
  type InteractionInputPolicy
} from './runtime'
import { createDrawInteraction } from './draw'
import { createEdgeInteraction } from './edge'
import { createInsertInteraction } from './insert'
import { createMindmapInteraction } from './mindmap'
import { createSelectionInteraction } from './selection'
import { createTransformInteraction } from './transform'
import { createViewportInteraction } from './viewport'

const createInteractionState = ({
  interaction,
  space
}: {
  interaction: ReturnType<typeof createInteractionRuntime>
  space: {
    get: () => boolean
    subscribe: BaseEditorRuntime['state']['tool']['subscribe']
  }
}) => createDerivedStore<EditorInteractionState>({
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
      space: readStore(space)
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

export const createWhiteboardRuntime = ({
  editor,
  engine,
  boardConfig,
  inputPolicy: initialInputPolicy
}: {
  editor: BaseEditorRuntime
  engine: EngineInstance
  boardConfig: BoardConfig
  inputPolicy: InteractionInputPolicy
}): WhiteboardRuntime => {
  const space = createValueStore(false)
  const inputPolicy = createValueStore<InteractionInputPolicy>({
    panEnabled: initialInputPolicy.panEnabled,
    wheelEnabled: initialInputPolicy.wheelEnabled,
    wheelSensitivity: initialInputPolicy.wheelSensitivity
  })
  let interactions: readonly InteractionFeature[] = []

  const interaction = createInteractionRuntime({
    getViewport: () => ({
      panScreenBy: editor.commands.viewport.panScreenBy,
      screenPoint: editor.read.viewport.screenPoint,
      size: editor.read.viewport.size
    }),
    getOwners: () => interactions.map((feature) => feature.owner),
    space
  })
  const snap = createSnapRuntime({
    readZoom: () => editor.read.viewport.get().zoom,
    node: {
      config: boardConfig.node,
      query: editor.read.index.snap.inRect
    },
    edge: {
      config: boardConfig.edge,
      nodeSize: boardConfig.nodeSize,
      query: editor.read.edge.connectCandidates
    }
  })

  const interactionCtx: InteractionCtx = {
    read: editor.read,
    state: {
      viewport: {
        input: {
          panScreenBy: editor.commands.viewport.panScreenBy
        }
      },
      space,
      inputPolicy
    },
    config: boardConfig,
    commands: editor.commands,
    overlay: editor.transient,
    snap
  }

  interactions = [
    createViewportInteraction(interactionCtx),
    createInsertInteraction(interactionCtx),
    createDrawInteraction(interactionCtx),
    createTransformInteraction(interactionCtx),
    createMindmapInteraction(interactionCtx),
    createSelectionInteraction(interactionCtx),
    createEdgeInteraction(interactionCtx)
  ]

  const clearInteractions = () => {
    for (let index = 0; index < interactions.length; index += 1) {
      interactions[index]!.clear?.()
    }
  }

  const input: EditorInput = {
    cancel: () => {
      interaction.cancel()
    },
    pointerDown: (input) => {
      const handled = interaction.handlePointerDown(input)
      return {
        handled,
        continuePointer: handled && interaction.busy.get()
      }
    },
    pointerMove: (input) => interaction.handlePointerMove(input),
    pointerUp: (input) => interaction.handlePointerUp(input),
    pointerCancel: (input) => interaction.handlePointerCancel(input),
    pointerLeave: () => {
      interaction.handlePointerLeave()
    },
    wheel: (input) => {
      const policy = inputPolicy.get()
      if (!policy.wheelEnabled) {
        return false
      }

      if (interaction.handleWheel(input)) {
        return true
      }

      editor.commands.viewport.wheel(input, policy.wheelSensitivity)
      return true
    },
    keyDown: (input) => interaction.handleKeyDown(input),
    keyUp: (input) => interaction.handleKeyUp(input),
    blur: () => {
      interaction.handleBlur()
    }
  }

  const interactionState = createInteractionState({
    interaction,
    space
  })
  const state = {
    ...editor.state,
    interaction: interactionState
  } satisfies WhiteboardRuntime['state']

  const resetInteractionRuntime = () => {
    input.cancel()
    clearInteractions()
  }

  const unsubscribeCommit = engine.commit.subscribe(() => {
    const commit = engine.commit.get()
    if (commit?.kind === 'replace') {
      resetInteractionRuntime()
    }
  })

  return {
    ...editor,
    state,
    input,
    configure: (config) => {
      inputPolicy.set({
        panEnabled: config.viewport.enablePan,
        wheelEnabled: config.viewport.enableWheel,
        wheelSensitivity: config.viewport.wheelSensitivity
      })

      editor.configure({
        tool: config.tool,
        viewport: {
          minZoom: config.viewport.minZoom,
          maxZoom: config.viewport.maxZoom
        },
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      unsubscribeCommit()
      resetInteractionRuntime()
      editor.dispose()
    }
  }
}
