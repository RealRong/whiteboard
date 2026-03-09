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

export const createWrite = ({
  instance,
  scheduler
}: WriteDeps): WriteControl => {
  const readNow = scheduler.now
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

  const commitOperations = (
    operations: readonly Operation[],
    origin: Origin
  ): WriteCommit => {
    const reduced = normalize.reduce(instance.document.get(), operations, origin)
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
      impact: reduced.read
    }
  }

  const replaceDocument = (
    document: Document,
    origin: Origin
  ): WriteCommit => {
    const committedDocument = normalize.document(assertDocument(document), origin)
    instance.document.commit(committedDocument)

    return {
      ok: true,
      kind: 'replace',
      doc: committedDocument,
      changes: {
        id: createId('change'),
        timestamp: readNow(),
        operations: [],
        origin
      }
    }
  }

  const history = createHistory<Operation, Origin, WriteCommit>({
    now: readNow,
    config: DEFAULT_HISTORY_CONFIG,
    replay: (operations) => {
      const committed = commitOperations(operations, 'system')
      return committed.ok ? committed : false
    }
  })

  const clearHistory = (committed: WriteCommit): WriteCommit => {
    if (committed.ok) {
      history.clear()
    }
    return committed
  }

  const captureHistory = (committed: WriteCommit): WriteCommit => {
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

  const apply = async <D extends WriteDomain>(payload: WriteInput<D>) => {
    const draft = planner(payload)
    if (!draft.ok) return draft

    return captureHistory(
      commitOperations(
        draft.operations,
        resolveOrigin(payload.source ?? 'ui')
      )
    )
  }

  const replaceSystemDocument = async (document: Document) =>
    clearHistory(replaceDocument(document, 'system'))

  return {
    apply,
    load: replaceSystemDocument,
    replace: replaceSystemDocument,
    history: {
      get: history.get,
      configure: history.configure,
      clear: history.clear,
      undo: history.undo,
      redo: history.redo
    }
  }
}
