import { READ_STATE_KEYS as ENGINE_READ_STATE_KEYS } from '@whiteboard/engine'
import type { Commands as EngineCommands, Instance as EngineInstance } from '@whiteboard/engine'
import type { DispatchResult, EdgeId, NodeId } from '@whiteboard/core/types'
import {
  interactionAtom,
  selectionAtom,
  toolAtom,
  uiStateAtoms,
  mergeInteraction,
  applySelectionState,
  createInitialInteractionState,
  createInitialSelectionState,
  type EditorTool,
  type SelectionMode
} from './uiState'
import type {
  EditorStateKey,
  EditorStateSnapshot,
  InternalWhiteboardInstance,
  WhiteboardCommands,
  WhiteboardRuntimeConfig
} from './types'
import { selectionBoxState } from '../interaction/selectionBoxState'
import { viewportGestureState } from '../interaction/viewportGestureState'
import { sessionLockState } from '../interaction/sessionLockState'
import { nodeInteractionPreviewState } from '../../node/interaction/nodeInteractionPreviewState'
import { edgeConnectPreviewState } from '../../edge/interaction/connectPreviewState'
import { edgeRoutingPreviewState } from '../../edge/interaction/routingPreviewState'
import { createViewportRuntime } from './runtime/viewport'

const ENGINE_STATE_KEYS = new Set<EditorStateKey>(['viewport'])
const UI_STATE_KEYS = ['tool', 'selection', 'interaction'] as const

type UiStateKey = (typeof UI_STATE_KEYS)[number]

const isUiStateKey = (key: EditorStateKey): key is UiStateKey =>
  key === 'tool' || key === 'selection' || key === 'interaction'

const resetUiTransientState = (instance: InternalWhiteboardInstance) => {
  instance.uiStore.set(selectionAtom, createInitialSelectionState())
  instance.uiStore.set(interactionAtom, createInitialInteractionState())
  selectionBoxState.reset(instance)
  viewportGestureState.reset(instance)
  sessionLockState.forceReset(instance)
  nodeInteractionPreviewState.clearTransient(instance)
  edgeConnectPreviewState.reset(instance)
  edgeRoutingPreviewState.reset(instance)
}

const readState = <K extends EditorStateKey>(
  instance: InternalWhiteboardInstance,
  key: K
): EditorStateSnapshot[K] => {
  if (key === 'tool') {
    return instance.uiStore.get(toolAtom) as EditorStateSnapshot[K]
  }
  if (key === 'selection') {
    return instance.uiStore.get(selectionAtom) as EditorStateSnapshot[K]
  }
  if (key === 'interaction') {
    return instance.uiStore.get(interactionAtom) as EditorStateSnapshot[K]
  }
  return instance.read.state.viewport as EditorStateSnapshot[K]
}

const subscribeState = (
  instance: InternalWhiteboardInstance,
  keys: readonly EditorStateKey[],
  listener: () => void
) => {
  const unsubs: Array<() => void> = []

  keys.forEach((key) => {
    if (isUiStateKey(key)) {
      unsubs.push(instance.uiStore.sub(uiStateAtoms[key], listener))
    }
  })

  const engineKeys = keys.filter((key) => ENGINE_STATE_KEYS.has(key))
  if (engineKeys.length) {
    unsubs.push(instance.read.subscribe([ENGINE_READ_STATE_KEYS.viewport], listener))
  }

  return () => {
    unsubs.forEach((off) => off())
  }
}

const withUiReset = async (
  instance: InternalWhiteboardInstance,
  effect: Promise<DispatchResult>
) => {
  const result = await effect
  if (result.ok) {
    resetUiTransientState(instance)
  }
  return result
}

export const createWhiteboardInstance = ({
  engine,
  uiStore,
  initialTool
}: {
  engine: EngineInstance
  uiStore: InternalWhiteboardInstance['uiStore']
  initialTool: EditorTool
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance

  uiStore.set(toolAtom, initialTool)
  uiStore.set(selectionAtom, createInitialSelectionState())
  uiStore.set(interactionAtom, createInitialInteractionState())

  const viewport = createViewportRuntime({
    readViewport: () => (
      viewportGestureState.getSnapshot(instance).preview
      ?? engine.read.state.viewport
    )
  })

  const tool: WhiteboardCommands['tool'] = {
    set: (nextTool) => {
      if (uiStore.get(toolAtom) === nextTool) return
      uiStore.set(toolAtom, nextTool)
    }
  }

  const interaction: WhiteboardCommands['interaction'] = {
    update: (patch) => {
      uiStore.set(interactionAtom, mergeInteraction(uiStore.get(interactionAtom), patch))
    },
    clearHover: () => {
      uiStore.set(
        interactionAtom,
        mergeInteraction(uiStore.get(interactionAtom), {
          hover: {
            nodeId: undefined,
            edgeId: undefined
          }
        })
      )
    }
  }

  const selection: WhiteboardCommands['selection'] = {
    select: (ids, mode: SelectionMode = 'replace') => {
      uiStore.set(selectionAtom, applySelectionState(uiStore.get(selectionAtom), ids, mode))
    },
    toggle: (ids) => {
      uiStore.set(selectionAtom, applySelectionState(uiStore.get(selectionAtom), ids, 'toggle'))
    },
    selectAll: () => {
      selection.select([...instance.read.projection.node.ids], 'replace')
    },
    clear: () => {
      uiStore.set(selectionAtom, {
        ...uiStore.get(selectionAtom),
        selectedEdgeId: undefined,
        selectedNodeIds: new Set<NodeId>(),
        mode: 'replace'
      })
    },
    getSelectedNodeIds: () => Array.from(uiStore.get(selectionAtom).selectedNodeIds)
  }

  const edge: WhiteboardCommands['edge'] = {
    ...engine.commands.edge,
    select: (id?: EdgeId) => {
      const current = uiStore.get(selectionAtom)
      if (current.selectedEdgeId === id) return
      uiStore.set(selectionAtom, {
        ...current,
        selectedEdgeId: id
      })
    }
  }

  instance = {
    engine,
    uiStore,
    state: {
      read: (key) => readState(instance, key),
      subscribe: (keys, listener) => subscribeState(instance, keys, listener)
    },
    read: engine.read,
    commands: {
      ...engine.commands,
      doc: {
        load: async (doc) => withUiReset(instance, engine.commands.doc.load(doc)),
        replace: async (doc) => withUiReset(instance, engine.commands.doc.replace(doc))
      },
      tool,
      interaction,
      selection,
      edge
    } as WhiteboardCommands,
    runtime: {
      configure: (config: WhiteboardRuntimeConfig) => {
        tool.set(config.tool)
        engine.runtime.configure({
          mindmapLayout: config.mindmapLayout,
          history: config.history
        })
      },
      viewport,
      dispose: () => {
        resetUiTransientState(instance)
        engine.runtime.dispose()
      }
    }
  }

  return instance
}
