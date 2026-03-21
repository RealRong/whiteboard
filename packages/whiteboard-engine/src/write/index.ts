import type { WriteControl, WriteDeps, WriteResult } from '@engine-types/write'
import type { WriteCommandMap, WriteDomain, WriteInput, WriteOutput } from '@engine-types/command'
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
import { cancelled, failure } from '../result'
import { plan } from './plan'
import { createWriteNormalize } from './normalize'
import { normalizeDocument } from '../document/normalize'

const resolveOrigin = (source: CommandSource): Origin =>
  source === 'remote' ? 'remote' : source === 'system' ? 'system' : 'user'

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

export const createWrite = ({
  instance
}: WriteDeps): WriteControl => {
  const readNow = now
  const planner = plan({ instance })

  const reduce = (
    document: Document,
    operations: readonly Operation[],
    origin: Origin
  ): KernelReduceResult => reduceOperations(document, operations, {
    now: readNow,
    origin
  })

  const normalize = createWriteNormalize({
    reduce,
    nodeSize: instance.config.nodeSize,
    groupPadding: instance.config.node.groupPadding
  })

  const commitOperations = <T>(
    operations: readonly Operation[],
    origin: Origin,
    data: T
  ): WriteResult<T> => {
    const currentDocument = instance.document.get()
    const reduced = normalize.reduce(currentDocument, operations, origin)
    if (!reduced.ok) {
      return failure(
        reduced.reason,
        reduced.message ?? 'Failed to reduce operations.'
      )
    }

    instance.document.commit(reduced.doc)

    return {
      ok: true,
      data,
      kind: 'operations',
      doc: reduced.doc,
      changes: reduced.changes,
      inverse: reduced.inverse,
      impact: reduced.read
    }
  }

  const replaceDocument = (
    document: Document
  ): WriteResult => {
    const committedDocument = normalizeDocument(
      assertDocument(document),
      instance.config
    )
    instance.document.commit(committedDocument)

    return {
      ok: true,
      data: undefined,
      kind: 'replace',
      doc: committedDocument,
      changes: {
        id: createId('change'),
        timestamp: readNow(),
        operations: [],
        origin: 'system'
      }
    }
  }

  const history = createHistory<Operation, Origin, WriteResult>({
    now: readNow,
    config: DEFAULT_HISTORY_CONFIG,
    replay: (operations) => {
      const committed = commitOperations(operations, 'system', undefined)
      return committed.ok ? committed : false
    }
  })

  const clearHistory = <T>(committed: WriteResult<T>): WriteResult<T> => {
    if (committed.ok) {
      history.clear()
    }
    return committed
  }

  const captureHistory = <T>(committed: WriteResult<T>): WriteResult<T> => {
    if (
      committed.ok
      && committed.kind === 'operations'
      && committed.inverse
    ) {
      history.capture({
        forward: committed.changes.operations,
        inverse: committed.inverse,
        origin: committed.changes.origin
      })
    }

    return committed
  }

  const apply = <
    D extends WriteDomain,
    C extends WriteCommandMap[D]
  >(payload: WriteInput<D, C>): WriteResult<WriteOutput<D, C>> => {
    const draft = planner(payload)
    if (!draft.ok) return draft

    return captureHistory(
      commitOperations(
        draft.data.operations,
        resolveOrigin(payload.source ?? 'user'),
        draft.data.output
      )
    )
  }

  const applyOperations = (
    operations: readonly Operation[],
    source: CommandSource = 'user'
  ): WriteResult => {
    if (!operations.length) {
      return cancelled('No operations provided.')
    }

    return captureHistory(
      commitOperations(
        operations,
        resolveOrigin(source),
        undefined
      )
    )
  }

  const replace = (document: Document) =>
    clearHistory(replaceDocument(document))

  return {
    apply,
    applyOperations,
    replace,
    history: {
      get: history.get,
      configure: history.configure,
      clear: history.clear,
      undo: history.undo,
      redo: history.redo
    }
  }
}
