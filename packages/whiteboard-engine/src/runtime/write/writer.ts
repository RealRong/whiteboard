import type { InternalInstance } from '@engine-types/instance/engine'
import type { ApplyMutationsApi, CommandSource } from '@engine-types/command/source'
import type {
  ApplyResult,
  Options as WriterOptions,
  ResetResult
} from '@engine-types/write/writer'
import type { Bus as ChangeBus } from '@engine-types/write/change'
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

type ApplyInput = {
  kind: 'apply'
  origin: Origin
  operations: Operation[]
}

type ReplaceInput = {
  kind: 'replace'
  origin: Origin
  doc: Document
  timestamp?: number
}

type WriteInput = ApplyInput | ReplaceInput
type WriteResult<T extends WriteInput> = T extends ApplyInput ? ApplyResult : ResetResult

export class Writer {
  private readonly instance: WriterOptions['instance']
  private readonly changeBus: ChangeBus
  private readonly documentAtom: PrimitiveAtom<Document>
  private readonly readModelRevisionAtom: PrimitiveAtom<number>
  private readonly now: () => number
  private readonly impactAnalyzer = new MutationImpactAnalyzer()
  private readonly timeline: History

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
    this.instance.runtime.store.set(this.documentAtom, doc)
    this.instance.runtime.store.set(
      this.readModelRevisionAtom,
      (revision: number) => revision + 1
    )
    this.instance.viewport.setViewport(doc.viewport ?? DEFAULT_DOCUMENT_VIEWPORT)
    return this.instance.document.get()
  }

  private publishChange = ({
    kind,
    origin,
    operations,
    impact,
    docBefore,
    docAfter
  }: {
    kind: 'apply' | 'replace'
    origin: Origin
    operations: Operation[]
    impact: ReturnType<MutationImpactAnalyzer['analyze']>
    docBefore: Document
    docAfter: Document
  }) => {
    const revision = this.instance.runtime.store.get(this.readModelRevisionAtom)
    this.changeBus.publish({
      revision,
      kind,
      origin,
      operations,
      impact,
      docBefore,
      docAfter
    })
  }

  private run = <T extends WriteInput>(input: T): WriteResult<T> => {
    if (input.kind === 'apply') {
      const docBefore = this.instance.document.get()
      const reduced = reduceOperations(docBefore, input.operations, {
        now: this.now,
        origin: input.origin,
        registries: this.createKernelRegistriesSnapshot()
      })
      if (!reduced.ok) {
        return reduced as unknown as WriteResult<T>
      }

      this.commitDocument(reduced.doc)
      const docAfter = this.syncDocumentState(reduced.doc)
      const operations = reduced.changes.operations
      this.publishChange({
        kind: 'apply',
        origin: input.origin,
        operations,
        impact: this.impactAnalyzer.analyze(operations),
        docBefore,
        docAfter
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
      } as unknown as WriteResult<T>
    }

    const docBefore = this.instance.document.get()
    this.commitDocument(input.doc, { silent: true })
    const docAfter = this.syncDocumentState(input.doc)
    this.publishChange({
      kind: 'replace',
      origin: input.origin,
      operations: [],
      impact: FULL_MUTATION_IMPACT,
      docBefore,
      docAfter
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
    } as unknown as WriteResult<T>
  }

  private applyHistoryOperations = (operations: Operation[]) =>
    this.run({
      kind: 'apply',
      operations,
      origin: 'system'
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

  mutate: ApplyMutationsApi = async (operations, source) => {
    const origin = this.toOrigin(source)
    const result = this.run({
      kind: 'apply',
      operations,
      origin
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

  applyDraft = async (
    draft: Draft,
    source: CommandSource
  ): Promise<DispatchResult> => {
    if (!draft.ok) return draft
    const result = await this.mutate(draft.operations, source)
    if (!result.ok) return result
    if (typeof draft.value === 'undefined') return result
    return {
      ...result,
      value: draft.value
    }
  }

  resetDoc = async (doc: Document): Promise<DispatchResult> => {
    this.timeline.clear()
    const result = this.run({
      kind: 'replace',
      doc,
      origin: 'system'
    })
    return {
      ok: true,
      changes: result.changes
    }
  }
}
