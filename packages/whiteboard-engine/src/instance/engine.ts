import type {
  CreateEngineOptions,
  InternalInstance,
  Instance
} from '@engine-types/instance/engine'
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
import { orchestrator as read } from '../runtime/read/orchestrator'
import { snapshot } from '../runtime/read/stages/snapshot'
import { createDocumentStore } from '../document/Store'
import { Reactions } from './reactions/Reactions'
import { createCommands } from './facade/commands'
import { createRuntimePort } from './facade/runtimePort'

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
  const documentStore = createDocumentStore(document, onDocumentChange)
  const { state, stateAtoms } = setupState({
    getDoc: documentStore.get,
    store: runtimeStore
  })
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

  const readRuntime = read({
    runtimeStore,
    stateAtoms,
    snapshotAtom,
    config,
    readDoc: documentStore.get,
    viewport
  })

  const instance: InternalInstance = {
    state,
    runtime: {
      store: runtimeStore,
      applyConfig: (() => {}) as InternalInstance['runtime']['applyConfig'],
      dispose: (() => {}) as InternalInstance['runtime']['dispose']
    },
    document: documentStore,
    config,
    viewport,
    registries: runtimeRegistries,
    query: readRuntime.query,
    read: readRuntime.read,
    commands: null as unknown as InternalInstance['commands']
  }
  state.write('tool', 'select')
  const writeRuntime = write({
    instance,
    scheduler,
    documentAtom: stateAtoms.document,
    readModelRevisionAtom: stateAtoms.readModelRevision
  })

  const reactions = new Reactions({
    instance,
    readRuntime,
    writeRuntime,
    scheduler
  })
  reactions.start()

  instance.commands = createCommands({
    state,
    viewport,
    reactions,
    writeRuntime
  })

  const shortcuts = bindShortcuts({
    instance,
    runAction: writeRuntime.commands.shortcut.execute
  })
  const runtimePort = createRuntimePort({
    state,
    viewport,
    history: writeRuntime.history,
    shortcuts,
    reactions,
    scheduler
  })

  instance.runtime.applyConfig = runtimePort.applyConfig
  instance.runtime.dispose = runtimePort.dispose

  return {
    state: instance.state,
    runtime: instance.runtime,
    query: instance.query,
    read: instance.read,
    commands: instance.commands
  }
}
