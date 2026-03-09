import type {
  CreateEngineOptions,
  Instance,
  RuntimeConfig
} from '@engine-types/instance'
import type { MindmapLayoutConfig } from '@engine-types/mindmap'
import type { Write, WriteCommit, WriteInstance } from '@engine-types/write'
import { assertDocument, type DispatchResult, type Document } from '@whiteboard/core/types'
import { createRegistries } from '@whiteboard/core/kernel'
import { atom, createStore } from 'jotai/vanilla'
import { createCommands } from '../commands'
import { resolveInstanceConfig } from '../config'
import { createRead } from '../read'
import { createWrite } from '../write'
import { Scheduler } from '../scheduling/Scheduler'

const EMPTY_MINDMAP_LAYOUT: MindmapLayoutConfig = {}

const assertImmutableDocumentInput = (
  currentDocument: Document,
  nextDocument: Document
) => {
  if (currentDocument !== nextDocument) return
  throw new Error(
    'Whiteboard engine requires immutable document inputs. Received the same document reference.'
  )
}

const toDispatchResult = (committed: WriteCommit): DispatchResult => {
  if (!committed.ok) return committed
  return {
    ok: true,
    changes: committed.changes
  }
}

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
  const documentAtom = atom(initialDocument)
  let mindmapLayout = EMPTY_MINDMAP_LAYOUT

  const getDocument = () => store.get(documentAtom)
  const commitDocument = (nextDocument: Document) => {
    const committedDocument = assertDocument(nextDocument)
    assertImmutableDocumentInput(getDocument(), committedDocument)
    store.set(documentAtom, committedDocument)
  }

  const context: WriteInstance = {
    document: {
      get: getDocument,
      commit: commitDocument
    },
    config,
    registries: resolvedRegistries
  }

  const read = createRead({
    store,
    documentAtom,
    getMindmapLayout: () => mindmapLayout,
    config
  })

  const writeControl = createWrite({
    instance: context,
    scheduler
  })

  const afterCommit = (committed: WriteCommit): DispatchResult => {
    if (!committed.ok) return committed

    if (committed.kind === 'replace') {
      read.invalidate.reset()
    } else {
      read.invalidate.impact(committed.impact)
    }

    if (committed.notify) {
      onDocumentChange?.(committed.doc)
    }

    return toDispatchResult(committed)
  }

  const write: Write = {
    apply: async (payload) => afterCommit(await writeControl.apply(payload)),
    load: async (doc) => afterCommit(await writeControl.load(doc)),
    replace: async (doc) => afterCommit(await writeControl.replace(doc)),
    history: {
      get: writeControl.history.get,
      configure: writeControl.history.configure,
      clear: writeControl.history.clear,
      undo: () => {
        const committed = writeControl.history.undo()
        if (!committed || !committed.ok) return false
        afterCommit(committed)
        return true
      },
      redo: () => {
        const committed = writeControl.history.redo()
        if (!committed || !committed.ok) return false
        afterCommit(committed)
        return true
      }
    }
  }

  const commands = createCommands({
    document: context.document,
    write
  })

  const configure = (nextConfig: RuntimeConfig) => {
    if (nextConfig.history) {
      write.history.configure(nextConfig.history)
    }

    const nextMindmapLayout = nextConfig.mindmapLayout ?? EMPTY_MINDMAP_LAYOUT
    if (!Object.is(mindmapLayout, nextMindmapLayout)) {
      mindmapLayout = nextMindmapLayout
      read.invalidate.mindmap()
    }
  }

  return {
    runtime: {
      configure,
      dispose: () => {
        writeControl.dispose()
        scheduler.cancelAll()
      }
    },
    read: read.api,
    commands
  }
}
