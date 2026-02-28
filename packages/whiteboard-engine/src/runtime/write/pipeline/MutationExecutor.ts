import type { InternalInstance } from '@engine-types/instance/instance'
import { FULL_MUTATION_IMPACT } from '../mutation/Impact'
import { MutationImpactAnalyzer } from '../mutation/Analyzer'
import { reduceOperations } from '@whiteboard/core/kernel'
import type { KernelRegistriesSnapshot } from '@whiteboard/core/kernel'
import { DEFAULT_DOCUMENT_VIEWPORT } from '../../../config'
import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'
import type { ChangeBus } from './ChangeBus'
import type { PrimitiveAtom } from 'jotai/vanilla'

type ResetDocumentInput = {
  doc: Document
  origin: Origin
  timestamp?: number
}

export type MutationAppliedChange = {
  docId: string | undefined
  origin: Origin
  operations: Operation[]
  reset?: boolean
}

export type MutationExecutorOptions = {
  instance: Pick<InternalInstance, 'document' | 'registries' | 'viewport' | 'runtime'>
  changeBus: ChangeBus
  documentAtom: PrimitiveAtom<Document>
  readModelRevisionAtom: PrimitiveAtom<number>
  now?: () => number
}

export type MutationExecutionResult =
  | {
      ok: true
      changes: ChangeSet
      inverse: Operation[]
      applied: MutationAppliedChange
    }
  | DispatchFailure

export type MutationResetResult = {
  ok: true
  changes: ChangeSet
  applied: MutationAppliedChange
}

export class MutationExecutor {
  private readonly instance: MutationExecutorOptions['instance']
  private readonly changeBus: ChangeBus
  private readonly documentAtom: PrimitiveAtom<Document>
  private readonly readModelRevisionAtom: PrimitiveAtom<number>
  private readonly now: () => number
  private readonly impactAnalyzer = new MutationImpactAnalyzer()

  constructor({
    instance,
    changeBus,
    documentAtom,
    readModelRevisionAtom,
    now
  }: MutationExecutorOptions) {
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
  }

  private createBatchId = (prefix: 'ms') => {
    const random = Math.random().toString(36).slice(2, 10)
    return `${prefix}_${Date.now().toString(36)}_${random}`
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
  ): MutationExecutionResult => {
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
    const applied: MutationAppliedChange = {
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

  resetDocument = ({
    doc,
    origin,
    timestamp
  }: ResetDocumentInput): MutationResetResult => {
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
    const applied: MutationAppliedChange = {
      docId: docAfter?.id,
      origin,
      operations: [],
      reset: true
    }

    return {
      ok: true,
      changes: {
        id: this.createBatchId('ms'),
        timestamp: timestamp ?? this.now(),
        operations: [],
        origin
      },
      applied
    }
  }
}
