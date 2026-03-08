import type {
  CreateEngineOptions,
  Instance
} from '@engine-types/instance/engine'
import type { Config as RuntimeConfig } from '@engine-types/instance/runtime'
import { assertDocument } from '@whiteboard/core/types'
import type { WriteInstance } from '@engine-types/write/deps'
import { createRegistries } from '@whiteboard/core/kernel'
import { createStore } from 'jotai/vanilla'
import { createCommands } from '../commands'
import { resolveInstanceConfig } from '../config'
import { createStoreState } from '../internal/store'
import { createReadRuntime } from '../runtime/read/kernel'
import { createWrite } from '../runtime/write'
import { Scheduler } from '../scheduling/Scheduler'
import { createDocumentRuntime } from './document/createDocumentRuntime'

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
  const initialDocument = assertDocument(document)
  const { stateAtoms } = createStoreState({
    getDoc: () => initialDocument
  })
  const documentRuntime = createDocumentRuntime({
    store,
    stateAtoms
  })
  const read = createReadRuntime({
    store,
    stateAtoms,
    config
  })

  const context: WriteInstance = {
    document: documentRuntime.document,
    config,
    viewport: documentRuntime.viewport,
    registries: resolvedRegistries
  }

  const write = createWrite({
    instance: context,
    scheduler,
    applyReadImpact: read.applyImpact,
    notifyDocumentChange: onDocumentChange
  })

  const commands = createCommands({
    document: documentRuntime.document,
    write
  })

  const configure = (nextConfig: RuntimeConfig) => {
    if (nextConfig.history) {
      write.history.configure(nextConfig.history)
    }

    const nextMindmapLayout = nextConfig.mindmapLayout ?? {}
    const currentMindmapLayout = store.get(stateAtoms.mindmapLayout)
    if (!Object.is(currentMindmapLayout, nextMindmapLayout)) {
      store.set(stateAtoms.mindmapLayout, nextMindmapLayout)
    }
  }

  return {
    runtime: {
      configure,
      dispose: () => {
        write.dispose()
        scheduler.cancelAll()
      }
    },
    read: read.api,
    commands
  }
}
