import type { Write } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import type { CommandSource } from '@engine-types/command/source'
import {
  assertDocument,
  type ChangeSet,
  type DispatchFailure,
  type DispatchResult,
  type Document,
  type Operation,
  type Origin
} from '@whiteboard/core/types'
import {
  createHistory,
  reduceOperations,
  type KernelReadImpact
} from '@whiteboard/core/kernel'
import { createId } from '@whiteboard/core/utils'
import { createResetReadImpact } from '../read/impact'
import { DEFAULT_CONFIG } from '../../config'
import { plan } from './stages/plan/router'
import type { Apply } from './stages/plan/draft'

export * from './api'

const resolveOrigin = (source: CommandSource): Origin => {
  if (source === 'remote') return 'remote'
  if (source === 'system' || source === 'import' || source === 'history') {
    return 'system'
  }
  return 'user'
}

const readNowFallback = () => {
  const runtime = globalThis as { performance?: { now?: () => number } }
  if (typeof runtime.performance?.now === 'function') {
    return runtime.performance.now()
  }
  return Date.now()
}

type HistoryMode = 'capture' | 'clear' | 'skip'

type CommitTarget = {
  origin: Origin
} & (
  | {
      operations: readonly Operation[]
    }
  | {
      doc: Document
      timestamp?: number
    }
)

type CommitResult =
  | {
      ok: true
      doc: Document
      changes: ChangeSet
      inverse?: readonly Operation[]
      read: KernelReadImpact
    }
  | DispatchFailure

type CommitInput = {
  notify?: boolean
  history: HistoryMode
  target: CommitTarget
}

// Single write funnel:
// `apply -> plan -> commit -> read -> react`.
export const createWrite = ({
  instance,
  scheduler,
  read,
  resetTransientState,
  react
}: WriteDeps): Write => {
  const readNow = scheduler.now ?? readNowFallback

  const execute = (target: CommitTarget): CommitResult => {
    if ('operations' in target) {
      const reduced = reduceOperations(instance.document.get(), target.operations, {
        now: readNow,
        origin: target.origin
      })
      if (!reduced.ok) {
        return reduced
      }

      instance.document.commit(reduced.doc)

      return {
        ok: true,
        doc: reduced.doc,
        changes: reduced.changes,
        inverse: reduced.inverse,
        read: reduced.read
      }
    }

    const committedDocument = assertDocument(target.doc)
    instance.document.commit(committedDocument)

    return {
      ok: true,
      doc: committedDocument,
      changes: {
        id: createId('change'),
        timestamp: target.timestamp ?? readNow(),
        operations: [],
        origin: target.origin
      },
      read: createResetReadImpact()
    }
  }

  const commit = ({
    notify = true,
    history: historyMode,
    target
  }: CommitInput): DispatchResult => {
    const committed = execute(target)
    if (!committed.ok) return committed

    if (historyMode === 'clear') {
      history.clear()
    } else if (historyMode === 'capture' && committed.inverse) {
      history.capture({
        forward: committed.changes.operations,
        inverse: committed.inverse,
        origin: committed.changes.origin
      })
    }

    read(committed.read)
    if (notify) {
      instance.document.notifyChange(committed.doc)
    }
    react(committed.read)

    return {
      ok: true,
      changes: committed.changes
    }
  }

  const history = createHistory<Operation, Origin>({
    now: readNow,
    config: DEFAULT_CONFIG.history,
    replay: (operations) =>
      commit({
        history: 'skip',
        target: {
          operations,
          origin: 'system'
        }
      }).ok
  })

  const replaceDocument = (doc: Document, notify: boolean) => {
    resetTransientState()
    return commit({
      notify,
      history: 'clear',
      target: {
        doc,
        origin: 'system'
      }
    })
  }

  const planner = plan({ instance })

  const apply: Apply = async (payload) => {
    const draft = planner(payload)
    if (!draft.ok) return draft

    return commit({
      history: 'capture',
      target: {
        operations: draft.operations,
        origin: resolveOrigin(payload.source ?? 'ui')
      }
    })
  }

  return {
    apply,
    load: async (doc) => replaceDocument(doc, false),
    replace: async (doc) => replaceDocument(doc, true),
    history: {
      get: history.get,
      configure: history.configure,
      undo: history.undo,
      redo: history.redo,
      clear: history.clear
    }
  }
}
