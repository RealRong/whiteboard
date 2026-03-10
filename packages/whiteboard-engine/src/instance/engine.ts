import type {
  CreateEngineOptions,
  Instance,
  RuntimeConfig
} from '@engine-types/instance'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { Write, WriteCommit, WriteInstance } from '@engine-types/write'
import type { DispatchResult } from '@whiteboard/core/types'
import { createRegistries } from '@whiteboard/core/kernel'
import { createCommands } from '../commands'
import { resolveInstanceConfig } from '../config'
import { createRead } from '../read'
import { createWrite } from '../write'
import { Scheduler } from '../scheduling/Scheduler'
import { createDocumentSource } from './document'

const EMPTY_MINDMAP_LAYOUT: MindmapLayoutConfig = {}

export const engine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): Instance => {
  const scheduler = new Scheduler()
  const config = resolveInstanceConfig(overrides)
  const resolvedRegistries = registries ?? createRegistries()
  const documentSource = createDocumentSource(document)
  let mindmapLayout = EMPTY_MINDMAP_LAYOUT

  const writeInstance: WriteInstance = {
    document: documentSource,
    config,
    registries: resolvedRegistries
  }

  const readControl = createRead({
    document: documentSource,
    mindmapLayout: () => mindmapLayout,
    config
  })

  const writer = createWrite({
    instance: writeInstance,
    scheduler
  })

  const syncRead = (committed: WriteCommit): DispatchResult => {
    if (!committed.ok) return committed
    readControl.commit(committed)

    return {
      ok: true,
      changes: committed.changes
    }
  }

  const publish = (committed: WriteCommit): DispatchResult => {
    const result = syncRead(committed)
    if (committed.ok) {
      onDocumentChange?.(committed.doc)
    }
    return result
  }

  const replay = (run: () => WriteCommit | false) => () => {
    const committed = run()
    if (!committed) return false
    publish(committed)
    return true
  }

  const write: Write = {
    apply: async (payload) => publish(await writer.apply(payload)),
    replace: async (doc) => syncRead(await writer.replace(doc)),
    history: {
      get: writer.history.get,
      clear: writer.history.clear,
      undo: replay(writer.history.undo),
      redo: replay(writer.history.redo)
    }
  }

  const commands = createCommands({
    write
  })

  const configure = ({
    history,
    mindmapLayout: nextMindmapLayout = EMPTY_MINDMAP_LAYOUT
  }: RuntimeConfig) => {
    if (history) {
      writer.history.configure(history)
    }

    if (Object.is(mindmapLayout, nextMindmapLayout)) return
    mindmapLayout = nextMindmapLayout
    readControl.rebuildMindmap()
  }

  const dispose = () => {
    scheduler.cancelAll()
  }

  return {
    config,
    read: readControl.read,
    commands,
    configure,
    dispose
  }
}
