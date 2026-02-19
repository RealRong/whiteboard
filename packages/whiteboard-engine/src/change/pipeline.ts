import type {
  ApplyDispatchResult,
  AppliedChangeSummary,
  ApplyApi,
  ApplyOptions,
  ApplyResult,
  Change,
  ChangeSet,
  ChangeSource,
  ChangeSetInput,
  TxApi
} from '@engine-types/change'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { InstanceEventMap } from '@engine-types/instance/events'
import type { Document, Operation } from '@whiteboard/core'
import { buildCanvasNodeDirtyHint, hasNodeOperation } from '../runtime/lifecycle/watchers/nodeHint'
import { normalizeChangeSet } from './normalize'
import { reduceChangeSet } from './reduce'
import { validateChangeSetInput } from './validate'

type CreateChangePipelineOptions = {
  instance: InternalInstance
  replaceDoc: (doc: Document | null) => void
  onApplied?: (summary: AppliedChangeSummary) => void
  onDocChanged?: (payload: InstanceEventMap['doc.changed']) => void
}

type ChangePipeline = {
  apply: ApplyApi
  tx: TxApi
}

export const createChangePipeline = ({
  instance,
  replaceDoc,
  onApplied,
  onDocChanged
}: CreateChangePipelineOptions): ChangePipeline => {
  const toDocOrigin = (source: ChangeSource): InstanceEventMap['doc.changed']['origin'] => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  const collectOperations = (
    dispatchResults: ApplyDispatchResult[]
  ): Operation[] => {
    const operations: Operation[] = []
    dispatchResults.forEach(({ result }) => {
      if (!result.ok) return
      operations.push(...result.changes.operations)
    })
    return operations
  }

  const toOperationTypes = (operations: Operation[], changeSet: ChangeSet): string[] => {
    const types = new Set<string>()
    operations.forEach((operation) => {
      types.add(operation.type)
    })
    if (changeSet.changes.some((change) => change.type === 'doc.reset')) {
      types.add('doc.reset')
    }
    return Array.from(types)
  }

  const syncGraphByOperations = (operations: Operation[]) => {
    if (hasNodeOperation(operations)) {
      const hint = buildCanvasNodeDirtyHint(operations, () => instance.runtime.core.query.node.list())
      if (hint.forceFull) {
        instance.graph.requestFullSync()
      } else {
        if (hint.dirtyNodeIds?.length) {
          instance.graph.reportDirty(hint.dirtyNodeIds, 'doc')
        }
        if (hint.orderChanged) {
          instance.graph.reportOrderChanged('doc')
        }
      }
    }
  }

  const now = () => {
    const runtime = globalThis as { performance?: { now?: () => number } }
    if (typeof runtime.performance?.now === 'function') {
      return runtime.performance.now()
    }
    return Date.now()
  }

  const apply: ApplyApi = async (input: ChangeSetInput, options?: ApplyOptions): Promise<ApplyResult> => {
    const startedAt = now()
    const docBefore = instance.runtime.docRef.current ?? null
    const validated = validateChangeSetInput(input)
    const changeSet = normalizeChangeSet(validated, options, {
      docId: instance.runtime.docRef.current?.id,
      source: 'system'
    })
    const dispatchResults = await reduceChangeSet(
      {
        core: instance.runtime.core,
        graph: instance.graph,
        docRef: instance.runtime.docRef,
        replaceDoc
      },
      changeSet
    )
    const operations = collectOperations(dispatchResults)
    syncGraphByOperations(operations)

    const docAfter = instance.runtime.docRef.current ?? null
    replaceDoc(docAfter)
    if (docBefore === docAfter) {
      instance.graph.flush('doc')
    }

    const operationTypes = toOperationTypes(operations, changeSet)

    const summary: AppliedChangeSummary = {
      id: changeSet.id,
      docId: changeSet.docId ?? docAfter?.id,
      source: changeSet.source,
      actor: changeSet.actor,
      timestamp: changeSet.timestamp,
      types: changeSet.changes.map((change) => change.type),
      operationTypes,
      metrics: {
        durationMs: now() - startedAt,
        changeCount: changeSet.changes.length,
        dispatchCount: dispatchResults.length
      }
    }

    if (operationTypes.length) {
      onDocChanged?.({
        docId: summary.docId,
        operationTypes,
        origin: toDocOrigin(changeSet.source)
      })
    }
    onApplied?.(summary)

    return {
      changeSet,
      dispatchResults,
      summary
    }
  }

  const tx: TxApi = async (run, options) => {
    const pending: Change[] = []
    const value = await run({
      add: (...changes) => {
        pending.push(...changes)
      }
    })
    if (!pending.length) return value
    await apply(pending, options)
    return value
  }

  return {
    apply,
    tx
  }
}
