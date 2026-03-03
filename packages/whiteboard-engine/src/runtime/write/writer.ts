import type {
  ApplyMutationsApi,
  CommandSource,
  CommandTrace
} from '@engine-types/command/source'
import type {
  ApplyResult,
  Options as WriterOptions,
  ResetResult
} from '@engine-types/write/writer'
import type {
  Bus as ChangeBus,
  ChangeTrace
} from '@engine-types/write/change'
import { FULL_MUTATION_IMPACT, MutationImpactAnalyzer } from './impact'
import { reduceOperations } from '@whiteboard/core/kernel'
import type { KernelRegistriesSnapshot } from '@whiteboard/core/kernel'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../config'
import type {
  DispatchResult,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { createBatchId } from './id'
import { History } from './history'
import type { Draft } from './model'
import { createReadInvalidation } from './readHints'

type ApplyTransaction = {
  kind: 'apply'
  source: CommandSource
  origin: Origin
  operations: Operation[]
  trace?: CommandTrace
}

type ReplaceTransaction = {
  kind: 'replace'
  source: CommandSource
  origin: Origin
  doc: Document
  timestamp?: number
  trace?: CommandTrace
}

type TransactionInput = ApplyTransaction | ReplaceTransaction
type TransactionResult<T extends TransactionInput> =
  T extends ApplyTransaction ? ApplyResult : ResetResult

export class Writer {
  private readonly instance: WriterOptions['instance']
  private readonly changeBus: ChangeBus
  private readonly readModelRevisionAtom: PrimitiveAtom<number>
  private readonly now: () => number
  private readonly impactAnalyzer = new MutationImpactAnalyzer()
  private readonly timeline: History

  constructor({
    instance,
    changeBus,
    readModelRevisionAtom,
    now
  }: WriterOptions) {
    this.instance = instance
    this.changeBus = changeBus
    this.readModelRevisionAtom = readModelRevisionAtom
    this.now = now ?? (() => {
      const runtime = globalThis as { performance?: { now?: () => number } }
      if (typeof runtime.performance?.now === 'function') {
        return runtime.performance.now()
      }
      return Date.now()
    })
    this.timeline = new History({ now: this.now })
  }

  private createKernelRegistriesSnapshot = (): KernelRegistriesSnapshot => ({
    nodeTypes: this.instance.registries.nodeTypes.list(),
    edgeTypes: this.instance.registries.edgeTypes.list(),
    nodeSchemas: this.instance.registries.schemas.listNodes(),
    edgeSchemas: this.instance.registries.schemas.listEdges(),
    serializers: this.instance.registries.serializers.list()
  })

  private commitDocument = (
    doc: Document,
    options?: { silent?: boolean }
  ) => {
    this.instance.document.replace(doc, options)
  }

  private syncDocumentState = (doc: Document) => {
    this.instance.runtime.store.set(
      this.readModelRevisionAtom,
      (revision: number) => revision + 1
    )
    this.instance.viewport.setViewport(doc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
    return this.instance.document.get()
  }

  private publishChange = ({
    kind,
    trace,
    impact
  }: {
    kind: 'apply' | 'replace'
    trace: ChangeTrace
    impact: ReturnType<MutationImpactAnalyzer['analyze']>
  }) => {
    const revision = this.instance.runtime.store.get(this.readModelRevisionAtom)
    const readHints = createReadInvalidation({
      kind,
      revision,
      impact
    })
    this.changeBus.publish({
      revision,
      kind,
      trace,
      readHints
    })
  }

  private normalizeTrace = (
    source: CommandSource,
    trace?: CommandTrace
  ): ChangeTrace => {
    const commandId = trace?.commandId ?? createBatchId('command')
    return {
      commandId,
      correlationId: trace?.correlationId ?? commandId,
      transactionId: trace?.transactionId,
      causationId: trace?.causationId,
      source
    }
  }

  private commitTransaction = <T extends TransactionInput>(
    input: T
  ): TransactionResult<T> => {
    const trace = this.normalizeTrace(input.source, input.trace)
    if (input.kind === 'apply') {
      const docBefore = this.instance.document.get()
      const reduced = reduceOperations(docBefore, input.operations, {
        now: this.now,
        origin: input.origin,
        registries: this.createKernelRegistriesSnapshot()
      })
      if (!reduced.ok) {
        return reduced as unknown as TransactionResult<T>
      }

      this.commitDocument(reduced.doc)
      const docAfter = this.syncDocumentState(reduced.doc)
      const operations = reduced.changes.operations
      this.publishChange({
        kind: 'apply',
        trace,
        impact: this.impactAnalyzer.analyze(operations)
      })

      return {
        ok: true,
        changes: reduced.changes,
        inverse: reduced.inverse,
        applied: {
          docId: docAfter?.id,
          origin: input.origin,
          operations
        }
      } as unknown as TransactionResult<T>
    }

    this.commitDocument(input.doc, { silent: true })
    const docAfter = this.syncDocumentState(input.doc)
    this.publishChange({
      kind: 'replace',
      trace,
      impact: FULL_MUTATION_IMPACT
    })

    return {
      ok: true,
      changes: {
        id: createBatchId('ms'),
        timestamp: input.timestamp ?? this.now(),
        operations: [],
        origin: input.origin
      },
      applied: {
        docId: docAfter?.id,
        origin: input.origin,
        operations: [],
        reset: true
      }
    } as unknown as TransactionResult<T>
  }

  private applyHistoryOperations = (operations: Operation[]) =>
    this.commitTransaction({
      kind: 'apply',
      operations,
      origin: 'system',
      source: 'system'
    }).ok

  readonly history = {
    get: () => this.timeline.getState(),
    configure: (config: Parameters<History['configure']>[0]) => {
      this.timeline.configure(config)
    },
    undo: () => this.timeline.undo(this.applyHistoryOperations),
    redo: () => this.timeline.redo(this.applyHistoryOperations),
    clear: () => this.timeline.clear()
  }

  private toOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  private commitOperations = ({
    operations,
    source,
    trace
  }: {
    operations: Operation[]
    source: CommandSource
    trace?: CommandTrace
  }): DispatchResult => {
    const origin = this.toOrigin(source)
    const result = this.commitTransaction({
      kind: 'apply',
      operations,
      origin,
      source,
      trace
    })
    if (!result.ok) return result

    this.timeline.capture({
      forward: result.changes.operations,
      inverse: result.inverse,
      origin,
      timestamp: result.changes.timestamp
    })

    return {
      ok: true,
      changes: result.changes
    }
  }

  mutate: ApplyMutationsApi = async (operations, source, trace) => {
    return this.commitOperations({
      operations,
      source,
      trace
    })
  }

  applyDraft = async (
    draft: Draft,
    source: CommandSource,
    trace?: CommandTrace
  ): Promise<DispatchResult> => {
    if (!draft.ok) return draft
    const result = this.commitOperations({
      operations: draft.operations,
      source,
      trace
    })
    if (!result.ok) return result
    if (typeof draft.value === 'undefined') return result
    return {
      ...result,
      value: draft.value
    }
  }

  resetDoc = async (doc: Document): Promise<DispatchResult> => {
    this.timeline.clear()
    const result = this.commitTransaction({
      kind: 'replace',
      doc,
      origin: 'system',
      source: 'system'
    })
    return {
      ok: true,
      changes: result.changes
    }
  }
}
