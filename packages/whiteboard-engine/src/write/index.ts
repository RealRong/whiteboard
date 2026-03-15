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
import { collectTreeImpact } from './treeImpact'

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

  const commitOperations = (
    operations: readonly Operation[],
    origin: Origin
  ): WriteCommit => {
    const currentDocument = instance.document.get()
    const reduced = normalize.reduce(currentDocument, operations, origin)
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
      impact: {
        ...reduced.read,
        tree: collectTreeImpact({
          before: currentDocument,
          after: reduced.doc,
          operations: reduced.changes.operations
        })
      }
    }
  }

  const replaceDocument = (
    document: Document
  ): WriteCommit => {
    const committedDocument = assertDocument(document)
    instance.document.commit(committedDocument)

      return {
        ok: true,
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
        resolveOrigin(payload.source ?? 'user')
      )
    )
  }

  const replace = async (document: Document) =>
    clearHistory(replaceDocument(document))

  return {
    apply,
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
