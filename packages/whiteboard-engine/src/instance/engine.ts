import type {
  CreateEngineOptions,
  Instance
} from '@engine-types/instance/engine'
import type { Api as InstanceApi } from '@engine-types/instance/runtime'
import type { Document } from '@whiteboard/core/types'
import type { WriteInstance } from '@engine-types/write/deps'
import { createRegistries } from '@whiteboard/core/kernel'
import { createStore } from 'jotai/vanilla'
import { createWrite } from '../runtime/write'
import { DEFAULT_DOCUMENT_VIEWPORT, resolveInstanceConfig } from '../config'
import { state as setupState } from '../state/factory/state'
import { createInitialState } from '../state/initialState'
import { Scheduler } from '../scheduling/Scheduler'
import { ViewportHost } from '../runtime/Viewport'
import { createReadKernel } from '../runtime/read/kernel'
import { createReactions, type Reactions } from './reactions/Reactions'
import { createCommands } from './facade/commands'

export const engine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): Instance => {
  const store = createStore()
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const resolvedRegistries = registries ?? createRegistries()
  const initialDocument = document
  const { state, stateAtoms } = setupState({
    getDoc: () => initialDocument,
    store
  })
  const readDocument = (): Document => store.get(stateAtoms.document)
  const resetTransientState = () => {
    const initialState = createInitialState()
    state.batch(() => {
      state.write('selection', initialState.selection)
      state.write('interaction', initialState.interaction)
    })
  }
  const commitDocument = (nextDocument: Document) => {
    store.set(stateAtoms.document, nextDocument)
    store.set(
      stateAtoms.readModelRevision,
      (revision: number) => revision + 1
    )
    viewport.setViewport(nextDocument.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
  }
  const notifyDocumentChange = (nextDocument: Document) => {
    onDocumentChange?.(nextDocument)
  }
  const viewport = new ViewportHost({
    store,
    atom: stateAtoms.viewport
  })

  const read = createReadKernel({
    store,
    stateAtoms,
    config,
    viewport
  })

  const baseInstance: WriteInstance = {
    document: {
      get: readDocument,
      commit: commitDocument,
      notifyChange: notifyDocumentChange
    },
    config,
    viewport,
    registries: resolvedRegistries
  }
  state.write('tool', 'select')

  let reactions: Reactions | undefined
  const write = createWrite({
    instance: baseInstance,
    scheduler,
    applyInvalidation: read.applyInvalidation,
    resetTransientState,
    react: (invalidation) => reactions?.ingest(invalidation)
  })

  const internalInstance = {
    state,
    ...baseInstance,
    read: read.read
  }

  reactions = createReactions({
    instance: internalInstance,
    write,
    scheduler
  })

  const commands = createCommands({
    instance: internalInstance,
    viewport,
    write
  })

  const runtime: InstanceApi = {
    store,
    applyConfig: (nextConfig) => {
      if (nextConfig.history) {
        write.history.configure(nextConfig.history)
      }
      state.write('tool', nextConfig.tool)
      viewport.setViewport(nextConfig.viewport)
      state.write('mindmapLayout', nextConfig.mindmapLayout ?? {})
    },
    dispose: () => {
      reactions?.dispose()
      scheduler.cancelAll()
    }
  }

  return {
    state,
    runtime,
    read: read.read,
    commands
  }
}
