import type {
  CreateEngineOptions,
  Instance
} from '@engine-types/instance/engine'
import type { Api as RuntimeApi } from '@engine-types/instance/runtime'
import type { Document } from '@whiteboard/core/types'
import type { WriteRuntimeInstance } from '@engine-types/write/deps'
import { createRegistries } from '@whiteboard/core/kernel'
import { createStore } from 'jotai/vanilla'
import { shortcuts as bindShortcuts } from '../runtime/shortcut'
import {
  runtime as write
} from '../runtime/write/runtime'
import { resolveInstanceConfig } from '../config'
import { state as setupState } from '../state/factory/state'
import { Scheduler } from '../runtime/Scheduler'
import { ViewportRuntime } from '../runtime/Viewport'
import { createReadKernel } from '../runtime/read/kernel'
import { snapshot } from '../runtime/read/stages/snapshot'
import { createReactions } from './reactions/Reactions'
import { createCommands } from './facade/commands'

export const engine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): Instance => {
  const runtimeStore = createStore()
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const runtimeRegistries = registries ?? createRegistries()
  const initialDocument = document
  const { state, stateAtoms } = setupState({
    getDoc: () => initialDocument,
    store: runtimeStore
  })
  const readDocument = (): Document => runtimeStore.get(stateAtoms.document)
  const setDocument = (nextDocument: Document) => {
    runtimeStore.set(stateAtoms.document, nextDocument)
  }
  const notifyDocumentChange = (nextDocument: Document) => {
    onDocumentChange?.(nextDocument)
  }
  const snapshotAtom = snapshot({
    documentAtom: stateAtoms.document,
    revisionAtom: stateAtoms.readModelRevision
  })
  const viewport = new ViewportRuntime({
    readViewport: () => runtimeStore.get(stateAtoms.viewport),
    writeViewport: (nextViewport) => {
      runtimeStore.set(stateAtoms.viewport, nextViewport)
    }
  })

  const readRuntime = createReadKernel({
    runtimeStore,
    stateAtoms,
    snapshotAtom,
    config,
    readDoc: readDocument,
    viewport
  })

  const baseInstance: WriteRuntimeInstance = {
    state,
    runtime: {
      store: runtimeStore
    },
    document: {
      get: readDocument,
      set: setDocument,
      notifyChange: notifyDocumentChange
    },
    config,
    viewport,
    registries: runtimeRegistries,
    query: readRuntime.query,
    read: readRuntime.read
  }
  state.write('tool', 'select')
  const writeRuntime = write({
    instance: baseInstance,
    scheduler,
    readModelRevisionAtom: stateAtoms.readModelRevision
  })

  const reactions = createReactions({
    instance: baseInstance,
    readRuntime,
    writeRuntime,
    scheduler
  })
  const commands = createCommands({
    state,
    viewport,
    writeRuntime
  })
  const shortcuts = bindShortcuts({
    state,
    runAction: writeRuntime.commands.shortcut.execute
  })

  const runtime: RuntimeApi = {
    store: runtimeStore,
    applyConfig: (nextConfig) => {
      if (nextConfig.history) {
        writeRuntime.history.configure(nextConfig.history)
      }
      state.write('tool', nextConfig.tool)
      viewport.setViewport(nextConfig.viewport)
      shortcuts.setShortcuts(nextConfig.shortcuts)
      state.write('mindmapLayout', nextConfig.mindmapLayout ?? {})
    },
    dispose: () => {
      reactions.dispose()
      shortcuts.dispose()
      scheduler.cancelAll()
    }
  }

  return {
    state,
    runtime,
    query: readRuntime.query,
    read: readRuntime.read,
    commands
  }
}
