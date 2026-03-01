import type { InternalInstance } from '@engine-types/instance/instance'
import type { ApplyMutationsApi, CommandSource } from '@engine-types/command'
import { FULL_MUTATION_IMPACT } from '../mutation/Impact'
import { MutationImpactAnalyzer } from '../mutation/Analyzer'
import { reduceOperations } from '@whiteboard/core/kernel'
import type { KernelRegistriesSnapshot } from '@whiteboard/core/kernel'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'
import type {
  ChangeSet,
  DispatchResult,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { ChangeBus } from './ChangeBus'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { createBatchId } from '../id'
import { HistoryDomain } from '../history/HistoryDomain'

type ResetInput = {
  doc: Document
  origin: Origin
  timestamp?: number
}

export type AppliedChange = {
  docId: string | undefined
  origin: Origin
  operations: Operation[]
  reset?: boolean
}

export type WriterOptions = {
  instance: Pick<InternalInstance, 'document' | 'registries' | 'viewport' | 'runtime'>
  changeBus: ChangeBus
  documentAtom: PrimitiveAtom<Document>
  readModelRevisionAtom: PrimitiveAtom<number>
  now?: () => number
}

export type ApplyResult =
  | {
      ok: true
      changes: ChangeSet
      inverse: Operation[]
      applied: AppliedChange
    }
  | DispatchFailure

export type ResetResult = {
  ok: true
  changes: ChangeSet
  applied: AppliedChange
}

export class Writer {
  private readonly instance: WriterOptions['instance']
  private readonly changeBus: ChangeBus
  private readonly documentAtom: PrimitiveAtom<Document>
  private readonly readModelRevisionAtom: PrimitiveAtom<number>
  private readonly now: () => number
  private readonly impactAnalyzer = new MutationImpactAnalyzer()
  private readonly historyDomain: HistoryDomain

  constructor({
    instance,
    changeBus,
    documentAtom,
    readModelRevisionAtom,
    now
  }: WriterOptions) {
    this.instance = instance
    this.changeBus = changeBus
    this.documentAtom = documentAtom
    this.readModelRevisionAtom = readModelRevisionAtom
    this.now = now ?? (() => {
      const runtime = globalThis as { performance?: { now?: () => number } }
      if (typeof runtime.performance?.now === 'function') {
        return runtime.performance.now()
      }
      return Date.now()
    })
    this.historyDomain = new HistoryDomain({ now: this.now })
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
    this.instance.runtime.store.set(this.documentAtom, doc)
    this.instance.runtime.store.set(
      this.readModelRevisionAtom,
      (revision: number) => revision + 1
    )
    this.instance.viewport.setViewport(doc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
    return this.instance.document.get()
  }

  applyOperations = (
    operations: Operation[],
    origin: Origin
  ): ApplyResult => {
    const docBefore = this.instance.document.get()
    const reduced = reduceOperations(docBefore, operations, {
      now: this.now,
      origin,
      registries: this.createKernelRegistriesSnapshot()
    })
    if (!reduced.ok) {
      return reduced
    }

    this.commitDocument(reduced.doc)
    const docAfter = this.syncDocumentState(reduced.doc)
    const impact = this.impactAnalyzer.analyze(reduced.changes.operations)
    const revision = this.instance.runtime.store.get(this.readModelRevisionAtom)
    this.changeBus.publish({
      revision,
      kind: 'apply',
      origin,
      operations: reduced.changes.operations,
      impact,
      docBefore,
      docAfter
    })
    const applied: AppliedChange = {
      docId: docAfter?.id,
      origin,
      operations: reduced.changes.operations
    }

    return {
      ok: true,
      changes: reduced.changes,
      inverse: reduced.inverse,
      applied
    }
  }

  private applyHistoryOperations = (operations: Operation[]) =>
    this.applyOperations(operations, 'system').ok

  readonly history = {
    get: () => this.historyDomain.getState(),
    configure: (config: Parameters<HistoryDomain['configure']>[0]) => {
      this.historyDomain.configure(config)
    },
    undo: () => this.historyDomain.undo(this.applyHistoryOperations),
    redo: () => this.historyDomain.redo(this.applyHistoryOperations),
    clear: () => this.historyDomain.clear()
  }

  private toOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  mutate: ApplyMutationsApi = async (operations, source) => {
    const origin = this.toOrigin(source)
    const result = this.applyOperations(operations, origin)
    if (!result.ok) return result

    this.historyDomain.capture({
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

  resetDocument = ({
    doc,
    origin,
    timestamp
  }: ResetInput): ResetResult => {
    const docBefore = this.instance.document.get()
    this.commitDocument(doc, { silent: true })
    const docAfter = this.syncDocumentState(doc)
    const impact = FULL_MUTATION_IMPACT
    const revision = this.instance.runtime.store.get(this.readModelRevisionAtom)
    this.changeBus.publish({
      revision,
      kind: 'replace',
      origin,
      operations: [],
      impact,
      docBefore,
      docAfter
    })
    const applied: AppliedChange = {
      docId: docAfter?.id,
      origin,
      operations: [],
      reset: true
    }

    return {
      ok: true,
      changes: {
        id: createBatchId('ms'),
        timestamp: timestamp ?? this.now(),
        operations: [],
        origin
      },
      applied
    }
  }

  resetDoc = async (doc: Document): Promise<DispatchResult> => {
    this.historyDomain.clear()
    const result = this.resetDocument({
      doc,
      origin: 'system'
    })
    return {
      ok: true,
      changes: result.changes
    }
  }
}
