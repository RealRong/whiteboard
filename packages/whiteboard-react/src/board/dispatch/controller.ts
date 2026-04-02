import {
  createDerivedStore,
  createValueStore,
  type EngineInstance,
  type ReadStore
} from '@whiteboard/engine'
import type { BoardConfig } from '@whiteboard/core/config'
import type {
  Editor,
  EditorInput,
  EditorInteractionState
} from '../types'
import {
  createInteractionRuntime
} from './runtime'
import { createSnapRuntime } from './snap'
import type { InteractionCtx, InteractionInputPolicy } from './ctx'
import type { InteractionFeature } from './types'
import { createDrawInteraction } from '../../features/draw/interaction'
import { createEdgeInteraction } from '../../features/edge/interaction'
import { createInsertInteraction } from '../../features/toolbox/interaction/insert'
import { createMindmapInteraction } from '../../features/mindmap/interaction'
import { createSelectionInteraction } from '../../features/selection/interaction'
import { createTransformInteraction } from '../../features/node/interaction/transform'
import { createViewportInteraction } from '../../features/viewport/interaction'

const createInteractionState = ({
  interaction,
  space
}: {
  interaction: ReturnType<typeof createInteractionRuntime>
  space: {
    get: () => boolean
    subscribe: ReadStore<boolean>['subscribe']
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

export type InteractionController = {
  state: ReadStore<EditorInteractionState>
  dispatch: EditorInput
  configure: (policy: InteractionInputPolicy) => void
  dispose: () => void
}

export const createInteractionController = ({
  editor,
  engine,
  boardConfig,
  inputPolicy: initialInputPolicy
}: {
  editor: Pick<Editor, 'read' | 'state' | 'commands' | 'transient'>
  engine: EngineInstance
  boardConfig: BoardConfig
  inputPolicy: InteractionInputPolicy
}): InteractionController => {
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

  const dispatch: EditorInput = {
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

  const state = createInteractionState({
    interaction,
    space
  })

  const reset = () => {
    dispatch.cancel()
    clearInteractions()
  }

  const unsubscribeCommit = engine.commit.subscribe(() => {
    const commit = engine.commit.get()
    if (commit?.kind === 'replace') {
      reset()
    }
  })

  return {
    state,
    dispatch,
    configure: (policy) => {
      inputPolicy.set({
        panEnabled: policy.panEnabled,
        wheelEnabled: policy.wheelEnabled,
        wheelSensitivity: policy.wheelSensitivity
      })
    },
    dispose: () => {
      unsubscribeCommit()
      reset()
    }
  }
}
