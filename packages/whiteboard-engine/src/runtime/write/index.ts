import type { Write } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import type {
  CommandSource
} from '@engine-types/command/source'
import type {
  ChangeSet,
  DispatchFailure,
  DispatchResult,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import {
  createHistory,
  reduceOperations,
  type KernelProjectionInvalidation
} from '@whiteboard/core/kernel'
import { createId } from '@whiteboard/core/utils'
import { FULL_READ_INVALIDATION } from './invalidation'
import { DEFAULT_CONFIG } from '../../config'
import { plan } from './stages/plan/router'
import type { Apply } from './stages/plan/draft'

export * from './invalidation'
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
      invalidation: KernelProjectionInvalidation
    }
  | DispatchFailure

type CommitInput = {
  source: CommandSource
  notify?: boolean
  history: HistoryMode
  target: CommitTarget
}

// Single write funnel:
// `apply -> plan -> commit -> invalidate -> notify -> react`.
export const createWrite = ({
  instance,
  scheduler,
  applyInvalidation,
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
        invalidation: reduced.invalidation
      }
    }

    instance.document.commit(target.doc)

    return {
      ok: true,
      doc: target.doc,
      changes: {
        id: createId('change'),
        timestamp: target.timestamp ?? readNow(),
        operations: [],
        origin: target.origin
      },
      invalidation: FULL_READ_INVALIDATION
    }
  }

  const commit = ({
    source,
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

    applyInvalidation(committed.invalidation)
    if (notify) {
      instance.document.notifyChange(committed.doc)
    }
    react(committed.invalidation)

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
        source: 'history',
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
      source: 'system',
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
      source: payload.source ?? 'ui',
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
