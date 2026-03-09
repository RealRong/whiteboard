import type { WriteCommit, WriteControl, WriteDeps } from '@engine-types/write'
import type { WriteDomain, WriteInput } from '@engine-types/command'
import type { CommandSource } from '@engine-types/command'
import {
  assertDocument,
  type Document,
  type Operation,
  type Origin
} from '@whiteboard/core/types'
import {
  createHistory,
  reduceOperations,
  type KernelReduceResult
} from '@whiteboard/core/kernel'
import { createId } from '@whiteboard/core/utils'
import { DEFAULT_HISTORY_CONFIG } from '../config'
import { plan } from './plan'
import { createWriteNormalize } from './normalize'

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

type CommittedWrite = WriteCommit

type CommitInput = {
  notify?: boolean
  history: HistoryMode
  target: CommitTarget
}

export type WriteHandle = WriteControl & {
  dispose: () => void
}

export const createWrite = ({
  instance,
  scheduler
}: WriteDeps): WriteHandle => {
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

  const normalize = createWriteNormalize({
    reduce: reduceCommitted,
    nodeSize: instance.config.nodeSize,
    groupPadding: instance.config.node.groupPadding
  })

  const execute = (target: CommitTarget, notify: boolean): CommittedWrite => {
    if ('operations' in target) {
      const reduced = normalize.reduce(
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
        kind: 'operations',
        doc: reduced.doc,
        changes: reduced.changes,
        inverse: reduced.inverse,
        impact: reduced.read,
        notify
      }
    }

    const committedDocument = normalize.document(
      assertDocument(target.doc),
      target.origin
    )
    instance.document.commit(committedDocument)

    return {
      ok: true,
      kind: 'replace',
      doc: committedDocument,
      changes: {
        id: createId('change'),
        timestamp: target.timestamp ?? readNow(),
        operations: [],
        origin: target.origin
      },
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
    } else if (historyMode === 'capture' && committed.kind === 'operations' && committed.inverse) {
      historyApi.capture({
        forward: committed.changes.operations,
        inverse: committed.inverse,
        origin: committed.changes.origin
      })
    }

    return committed
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

  const history: WriteControl['history'] = {
    get: historyApi.get,
    configure: historyApi.configure,
    clear: historyApi.clear,
    undo: () => {
      lastHistoryCommit = null
      historyApi.undo()
      const committed = getLastHistoryCommit()
      if (!committed || !committed.ok) return false
      return committed
    },
    redo: () => {
      lastHistoryCommit = null
      historyApi.redo()
      const committed = getLastHistoryCommit()
      if (!committed || !committed.ok) return false
      return committed
    }
  }

  const replaceDocument = async (doc: Document, notify: boolean) => {
    return commit({
      notify,
      history: 'clear',
      target: {
        doc,
        origin: 'system'
      }
    })
  }

  return {
    apply: async (payload) => applyCommitted(payload),
    load: async (doc) => replaceDocument(doc, false),
    replace: async (doc) => replaceDocument(doc, true),
    history,
    dispose: () => {
    }
  }
}
