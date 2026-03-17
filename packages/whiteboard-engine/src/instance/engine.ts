import type {
  CreateEngineOptions,
  EngineInstance,
  EngineRuntimeOptions
} from '@engine-types/instance'
import type { MindmapLayoutConfig } from '@whiteboard/core/mindmap'
import type { Write, WriteCommit, WriteInstance } from '@engine-types/write'
import { createValueStore } from '@whiteboard/core/runtime'
import { createRegistries } from '@whiteboard/core/kernel'
import { createCommands } from '../commands'
import { resolveBoardConfig } from '../config'
import { createRead } from '../read'
import { MINDMAP_LAYOUT_READ_IMPACT, RESET_READ_IMPACT } from '../read/impacts'
import { createWrite } from '../write'
import { createDocumentSource } from './document'
import type { Commit, CommitResult } from '@engine-types/commit'

const EMPTY_MINDMAP_LAYOUT: MindmapLayoutConfig = {}

export const createEngine = ({
  registries,
  document,
  onDocumentChange,
  config: overrides
}: CreateEngineOptions): EngineInstance => {
  const config = resolveBoardConfig(overrides)
  const resolvedRegistries = registries ?? createRegistries()
  const documentSource = createDocumentSource(document)
  const commit = createValueStore<Commit | null>(null)
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
    instance: writeInstance
  })

  const toCommit = (
    committed: Extract<WriteCommit, { ok: true }>,
    kind: Commit['kind']
  ): Commit => (
    committed.kind === 'operations'
      ? {
          ok: true,
          kind,
          doc: committed.doc,
          changes: committed.changes,
          impact: committed.impact
        }
      : {
          ok: true,
          kind,
          doc: committed.doc,
          changes: committed.changes
        }
  )

  const publish = (
    committed: WriteCommit,
    kind: Commit['kind']
  ): CommitResult => {
    if (!committed.ok) return committed

    if (committed.kind === 'replace') {
      readControl.invalidate(RESET_READ_IMPACT)
    } else {
      readControl.invalidate(committed.impact)
    }

    const nextCommit = toCommit(committed, kind)
    commit.set(nextCommit)
    onDocumentChange?.(committed.doc)
    return nextCommit
  }

  const replay = (
    run: () => WriteCommit | false,
    kind: Extract<Commit['kind'], 'undo' | 'redo'>
  ) => () => {
    const committed = run()
    if (!committed) {
      return {
        ok: false,
        reason: 'cancelled',
        message: kind === 'undo' ? 'Nothing to undo.' : 'Nothing to redo.'
      } as const
    }
    return publish(committed, kind)
  }

  const write: Write = {
    apply: async (payload) => publish(await writer.apply(payload), 'apply'),
    replace: async (doc) => publish(await writer.replace(doc), 'replace'),
    history: {
      get: writer.history.get,
      clear: writer.history.clear,
      undo: replay(writer.history.undo, 'undo'),
      redo: replay(writer.history.redo, 'redo')
    }
  }

  const commands = createCommands({
    write
  })

  const configure = ({
    history,
    mindmapLayout: nextMindmapLayout = EMPTY_MINDMAP_LAYOUT
  }: EngineRuntimeOptions) => {
    if (history) {
      writer.history.configure(history)
    }

    if (Object.is(mindmapLayout, nextMindmapLayout)) return
    mindmapLayout = nextMindmapLayout
    readControl.invalidate(MINDMAP_LAYOUT_READ_IMPACT)
  }

  const dispose = () => {}

  return {
    config,
    read: readControl.read,
    commit,
    commands,
    configure,
    dispose
  }
}
