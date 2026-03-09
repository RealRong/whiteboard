import type { Instance as EngineInstance } from '@whiteboard/engine'
import {
  panViewport,
  zoomViewport
} from '@whiteboard/core/geometry'
import type { DispatchFailureReason, DispatchResult, EdgeId, NodeId, Viewport } from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
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
import { createSelectionState } from './selectionState'
import { selectionBoxState } from '../interaction/selectionBoxState'
import { viewportGestureState } from '../interaction/viewportGestureState'
import { sessionLockState } from '../interaction/sessionLockState'
import { nodeInteractionPreviewState } from '../../node/interaction/nodeInteractionPreviewState'
import { edgeConnectPreviewState } from '../../edge/interaction/connectPreviewState'
import { edgeRoutingPreviewState } from '../../edge/interaction/routingPreviewState'
import {
  createViewportRuntime,
  DEFAULT_VIEWPORT,
  type ViewportRuntimeControl
} from './runtime/viewport'

const assertNever = (value: never): never => {
  throw new Error(`Unknown editor state key: ${String(value)}`)
}

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
  return assertNever(key)
}

const subscribeState = (
  instance: InternalWhiteboardInstance,
  keys: readonly EditorStateKey[],
  listener: () => void
) => {
  const unsubs: Array<() => void> = []

  keys.forEach((key) => {
    unsubs.push(instance.uiStore.sub(uiStateAtoms[key], listener))
  })

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

const failureResult = (
  reason: DispatchFailureReason,
  message?: string
): Promise<DispatchResult> =>
  Promise.resolve({
    ok: false,
    reason,
    message
  })

const invalidResult = (message: string): Promise<DispatchResult> =>
  failureResult('invalid', message)

const cancelledResult = (message?: string): Promise<DispatchResult> =>
  failureResult('cancelled', message)

const successResult = (): Promise<DispatchResult> =>
  Promise.resolve({
    ok: true,
    changes: {
      id: createId('change'),
      timestamp: Date.now(),
      operations: [],
      origin: 'user'
    }
  })

export const createWhiteboardInstance = ({
  engine,
  uiStore,
  initialTool,
  initialViewport = DEFAULT_VIEWPORT
}: {
  engine: EngineInstance
  uiStore: InternalWhiteboardInstance['uiStore']
  initialTool: EditorTool
  initialViewport?: Viewport
}): InternalWhiteboardInstance => {
  let instance!: InternalWhiteboardInstance
  let viewport!: ViewportRuntimeControl

  uiStore.set(toolAtom, initialTool)
  uiStore.set(selectionAtom, createInitialSelectionState())
  uiStore.set(interactionAtom, createInitialInteractionState())
  const selectionState = createSelectionState({ uiStore })

  viewport = createViewportRuntime({
    initialViewport,
    readEffectiveViewport: () => (
      viewportGestureState.getSnapshot(instance).preview
      ?? viewport.getCommitted()
    )
  })

  const applyViewport = (nextViewport: Viewport) => {
    try {
      if (!viewport.commit(nextViewport)) {
        return cancelledResult()
      }
      return successResult()
    } catch (error) {
      return invalidResult(
        error instanceof Error ? error.message : 'Invalid viewport.'
      )
    }
  }

  const viewportCommands: WhiteboardCommands['viewport'] = {
    set: (nextViewport) => applyViewport(nextViewport),
    panBy: (delta) => {
      if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
        return invalidResult('Invalid pan delta.')
      }
      return applyViewport(panViewport(viewport.getCommitted(), delta))
    },
    zoomBy: (factor, anchor) => {
      if (!Number.isFinite(factor) || factor <= 0) {
        return invalidResult('Invalid zoom factor.')
      }
      return applyViewport(zoomViewport(viewport.getCommitted(), factor, anchor))
    },
    zoomTo: (zoom, anchor) => {
      const current = viewport.getCommitted()
      const factor = current.zoom === 0 ? zoom : zoom / current.zoom
      if (!Number.isFinite(factor) || factor <= 0) {
        return invalidResult('Invalid zoom factor.')
      }
      return applyViewport(zoomViewport(current, factor, anchor))
    },
    reset: () => applyViewport(DEFAULT_VIEWPORT)
  }

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
      selection.select([...instance.read.node.ids()], 'replace')
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
      subscribe: (keys, listener) => subscribeState(instance, keys, listener),
      selection: selectionState.selection
    },
    config: engine.config,
    read: engine.read,
    commands: {
      ...engine.commands,
      document: {
        replace: async (doc) =>
          withUiReset(instance, engine.commands.document.replace(doc))
      },
      viewport: viewportCommands,
      tool,
      interaction,
      selection,
      edge
    } as WhiteboardCommands,
    viewport,
    configure: (config: WhiteboardRuntimeConfig) => {
      tool.set(config.tool)
      engine.configure({
        mindmapLayout: config.mindmapLayout,
        history: config.history
      })
    },
    dispose: () => {
      selectionState.dispose()
      resetUiTransientState(instance)
      engine.dispose()
    }
  }

  return instance
}
