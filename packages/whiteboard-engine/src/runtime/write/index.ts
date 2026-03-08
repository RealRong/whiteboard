import type { Write } from '@engine-types/write/runtime'
import type { WriteDeps } from '@engine-types/write/deps'
import type { WriteDomain, WriteInput } from '@engine-types/command/api'
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
  type KernelReadImpact,
  type KernelReduceResult
} from '@whiteboard/core/kernel'
import { normalizeGroupBounds } from '@whiteboard/core/node'
import { createId } from '@whiteboard/core/utils'
import { DEFAULT_HISTORY_CONFIG, DEFAULT_TUNING } from '../../config'
import { createResetReadImpact } from '../read/impact'
import { plan } from './stages/plan/router'

const resolveOrigin = (source: CommandSource): Origin => {
  if (source === 'remote') return 'remote'
  if (source === 'system' || source === 'import' || source === 'history') {
    return 'system'
  }
  return 'user'
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

type SuccessfulWrite = {
  ok: true
  doc: Document
  changes: ChangeSet
  inverse?: readonly Operation[]
  impact: KernelReadImpact
  notify: boolean
}

type CommittedWrite = SuccessfulWrite | DispatchFailure

type CommitInput = {
  notify?: boolean
  history: HistoryMode
  target: CommitTarget
}

export type WriteRuntime = Write & {
  dispose: () => void
}

export const createWrite = ({
  instance,
  scheduler,
  applyReadImpact,
  notifyDocumentChange
}: WriteDeps): WriteRuntime => {
  const readNow = scheduler.now
  const planner = plan({ instance })
  let lastHistoryCommit: CommittedWrite | null = null

  const getLastHistoryCommit = (): CommittedWrite | null => lastHistoryCommit

  const reduceCommitted = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => reduceOperations(document, operations, {
    now: readNow,
    origin
  })

  const buildNormalizeOperations = (document: Document): readonly Operation[] =>
    normalizeGroupBounds({
      document,
      nodeSize: instance.config.nodeSize,
      groupPadding: instance.config.node.groupPadding,
      rectEpsilon: DEFAULT_TUNING.group.rectEpsilon
    })

  const normalizeDocument = (document: Document, origin: Origin): Document => {
    const normalizeOperations = buildNormalizeOperations(document)
    if (!normalizeOperations.length) return document

    const normalized = reduceCommitted(document, normalizeOperations, origin)
    if (normalized.ok) {
      return normalized.doc
    }

    throw new Error(`Group normalize failed: ${normalized.message}`)
  }

  const reduceWithNormalize = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => {
    const planned = reduceCommitted(document, operations, origin)
    if (!planned.ok) return planned

    const normalizeOperations = buildNormalizeOperations(planned.doc)
    if (!normalizeOperations.length) {
      return planned
    }

    return reduceCommitted(
      document,
      [...planned.changes.operations, ...normalizeOperations],
      origin
    )
  }

  const execute = (target: CommitTarget, notify: boolean): CommittedWrite => {
    if ('operations' in target) {
      const reduced = reduceWithNormalize(
        instance.document.get(),
        target.operations,
        target.origin
      )
      if (!reduced.ok) {
        return reduced
      }

      instance.document.commit(reduced.doc)

      return {
        ok: true,
        doc: reduced.doc,
        changes: reduced.changes,
        inverse: reduced.inverse,
        impact: reduced.read,
        notify
      }
    }

    const committedDocument = normalizeDocument(
      assertDocument(target.doc),
      target.origin
    )
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
      impact: createResetReadImpact(),
      notify
    }
  }

  const historyApi = createHistory<Operation, Origin>({
    now: readNow,
    config: DEFAULT_HISTORY_CONFIG,
    replay: (operations) => {
      lastHistoryCommit = commit({
        history: 'skip',
        target: {
          operations,
          origin: 'system'
        }
      })
      return lastHistoryCommit.ok
    }
  })

  const commit = ({
    notify = true,
    history: historyMode,
    target
  }: CommitInput): CommittedWrite => {
    const committed = execute(target, notify)
    if (!committed.ok) return committed

    if (historyMode === 'clear') {
      historyApi.clear()
    } else if (historyMode === 'capture' && committed.inverse) {
      historyApi.capture({
        forward: committed.changes.operations,
        inverse: committed.inverse,
        origin: committed.changes.origin
      })
    }

    return committed
  }

  const publish = (committed: CommittedWrite): DispatchResult => {
    if (!committed.ok) return committed

    applyReadImpact(committed.impact)

    if (committed.notify) {
      notifyDocumentChange?.(committed.doc)
    }

    return {
      ok: true,
      changes: committed.changes
    }
  }

  const applyCommitted = async <D extends WriteDomain>(payload: WriteInput<D>) => {
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

  const history = {
    get: historyApi.get,
    configure: historyApi.configure,
    clear: historyApi.clear,
    undo: () => {
      lastHistoryCommit = null
      historyApi.undo()
      const committed = getLastHistoryCommit()
      if (!committed || !committed.ok) return false
      publish(committed)
      return true
    },
    redo: () => {
      lastHistoryCommit = null
      historyApi.redo()
      const committed = getLastHistoryCommit()
      if (!committed || !committed.ok) return false
      publish(committed)
      return true
    }
  }

  const replaceDocument = async (doc: Document, notify: boolean) => {
    return publish(
      commit({
        notify,
        history: 'clear',
        target: {
          doc,
          origin: 'system'
        }
      })
    )
  }

  return {
    apply: async (payload) => publish(await applyCommitted(payload)),
    load: async (doc) => replaceDocument(doc, false),
    replace: async (doc) => replaceDocument(doc, true),
    history,
    dispose: () => {}
  }
}
