import type { Write } from '@engine-types/write/runtime'
import type { Deps as WriteDeps } from '@engine-types/write/deps'
import type {
  CommandSource,
  CommandTrace
} from '@engine-types/command/source'
import type { ChangeTrace } from '@engine-types/write/change'
import type { ReadInvalidation } from '@engine-types/read/invalidation'
import type {
  DispatchResult,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import { createId } from '@whiteboard/core/utils'
import {
  FULL_READ_INVALIDATION,
  planReadInvalidation
} from './stages/invalidation/plan'
import { Writer } from './stages/commit/writer'
import { History } from './stages/commit/history'
import { bus } from './stages/invalidation/changeBus'
import { plan } from './stages/plan/router'
import type { Apply } from './stages/plan/draft'

const resolveOrigin = (source: CommandSource): Origin => {
  if (source === 'remote') return 'remote'
  if (source === 'system' || source === 'import' || source === 'history') {
    return 'system'
  }
  return 'user'
}

const createTrace = (
  source: CommandSource,
  trace?: CommandTrace
): ChangeTrace => ({
  commandId: trace?.commandId ?? createId('command'),
  source
})

// Write assembly (single write funnel):
// `apply -> plan -> commit -> read invalidation -> notify -> publish`.
// `Writer` only commits documents. Trace/invalidation/history live here.
export const createWrite = ({
  instance,
  scheduler,
  applyInvalidation
}: WriteDeps): Write => {
  const changeBus = bus()
  const writer = new Writer({
    document: instance.document,
    now: scheduler.now
  })

  const publish = ({
    doc,
    trace,
    invalidation,
    notify
  }: {
    doc: Document
    trace: ChangeTrace
    invalidation: ReadInvalidation
    notify: boolean
  }) => {
    applyInvalidation(invalidation)
    if (notify) {
      instance.document.notifyChange(doc)
    }
    changeBus.publish({
      trace,
      invalidation
    })
  }

  const applyOperations = ({
    operations,
    source,
    trace,
    captureHistory = true
  }: {
    operations: readonly Operation[]
    source: CommandSource
    trace?: CommandTrace
    captureHistory?: boolean
  }): DispatchResult => {
    const committed = writer.commitOperations({
      operations,
      origin: resolveOrigin(source)
    })
    if (!committed.ok) return committed

    publish({
      doc: committed.doc,
      trace: createTrace(source, trace),
      invalidation: planReadInvalidation(committed.changes.operations),
      notify: true
    })

    if (captureHistory) {
      history.capture({
        forward: committed.changes.operations,
        inverse: committed.inverse,
        origin: committed.changes.origin
      })
    }

    return {
      ok: true,
      changes: committed.changes
    }
  }

  const history = new History({
    now: scheduler.now,
    replay: (operations) =>
      applyOperations({
        operations,
        source: 'history',
        captureHistory: false
      }).ok
  })

  const commitDocument = ({
    doc,
    notify
  }: {
    doc: Document
    notify: boolean
  }): DispatchResult => {
    history.clear()

    const committed = writer.commitDocument({
      doc,
      origin: 'system'
    })

    publish({
      doc: committed.doc,
      trace: createTrace('system'),
      invalidation: FULL_READ_INVALIDATION,
      notify
    })

    return {
      ok: true,
      changes: committed.changes
    }
  }

  const planner = plan({ instance })

  const apply: Apply = async (payload) => {
    const draft = planner(payload)
    if (!draft.ok) return draft

    const result = applyOperations({
      operations: draft.operations,
      source: payload.source ?? 'ui',
      trace: payload.trace
    })
    if (!result.ok || typeof draft.value === 'undefined') return result

    return {
      ...result,
      value: draft.value
    }
  }

  return {
    apply,
    load: async (doc) => commitDocument({ doc, notify: false }),
    replace: async (doc) => commitDocument({ doc, notify: true }),
    history: {
      get: history.get,
      configure: history.configure,
      undo: history.undo,
      redo: history.redo,
      clear: history.clear
    },
    subscribe: changeBus.subscribe
  }
}
