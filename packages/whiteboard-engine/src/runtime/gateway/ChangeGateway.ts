import type {
  AppliedChangeSummary,
  ApplyMutationsApi,
  ApplyMutationsResult,
  Command,
  CommandSource,
  MutationBatch,
  MutationBatchInput
} from '@engine-types/command'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { GraphChange } from '@engine-types/graph'
import type { InstanceEventEmitter } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { HistoryState } from '@engine-types/state'
import type { DocumentStore } from '../../document/Store'
import type { HistoryStore } from '../../document/History'
import {
  buildIntent,
  reduceOperations,
  type CoreRegistries,
  type DispatchResult,
  type Document,
  type Intent,
  type KernelRegistriesSnapshot,
  type Operation,
  type Origin
} from '@whiteboard/core'

type GraphRuntime = {
  syncAfterMutations: (operations: Operation[]) => GraphChange | undefined
}

type ViewRuntime = {
  sync: (change: GraphChange | undefined) => void
}

type IntentDispatchOptions = {
  source?: CommandSource
  actor?: string
  timestamp?: number
  docId?: string
}

type ResetDocumentOptions = {
  source?: CommandSource
  actor?: string
  timestamp?: number
}

export type ChangeGatewayDependencies = {
  instance: InternalInstance
  documentStore: DocumentStore
  history: HistoryStore
  registries: CoreRegistries
  replaceDoc: (doc: Document | null) => void
  now?: () => number
  graph: GraphRuntime
  view: ViewRuntime
  emit: InstanceEventEmitter['emit']
}

export class ChangeGateway {
  private readonly instance: InternalInstance
  private readonly documentStore: DocumentStore
  private readonly historyStore: HistoryStore
  private readonly registries: CoreRegistries
  private readonly replaceDoc: (doc: Document | null) => void
  private readonly now: () => number
  private readonly graphRuntime: ChangeGatewayDependencies['graph']
  private readonly viewRuntime: ChangeGatewayDependencies['view']
  private readonly emit: InstanceEventEmitter['emit']

  constructor({
    instance,
    documentStore,
    history,
    registries,
    replaceDoc,
    now,
    graph,
    view,
    emit
  }: ChangeGatewayDependencies) {
    this.instance = instance
    this.documentStore = documentStore
    this.historyStore = history
    this.registries = registries
    this.replaceDoc = replaceDoc
    this.now = now ?? (() => {
      const runtime = globalThis as { performance?: { now?: () => number } }
      if (typeof runtime.performance?.now === 'function') {
        return runtime.performance.now()
      }
      return Date.now()
    })
    this.graphRuntime = graph
    this.viewRuntime = view
    this.emit = emit
  }

  private createBatchId = (prefix: 'ms') => {
    const random = Math.random().toString(36).slice(2, 10)
    return `${prefix}_${Date.now().toString(36)}_${random}`
  }

  private toOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  private createMutationBatch = (input: MutationBatchInput): MutationBatch => ({
    id: input.id ?? this.createBatchId('ms'),
    docId: input.docId ?? this.documentStore.get().id,
    source: input.source ?? 'system',
    actor: input.actor,
    timestamp: input.timestamp ?? Date.now(),
    operations: input.operations
  })

  private createKernelRegistriesSnapshot = (): KernelRegistriesSnapshot => ({
    nodeTypes: this.registries.nodeTypes.list(),
    edgeTypes: this.registries.edgeTypes.list(),
    nodeSchemas: this.registries.schemas.listNodes(),
    edgeSchemas: this.registries.schemas.listEdges(),
    serializers: this.registries.serializers.list()
  })

  private commitDocument = (
    doc: Document,
    options?: { silent?: boolean }
  ) => {
    this.documentStore.replace(doc, options)
  }

  private reduceWithCommit = (
    operations: Operation[],
    origin: Origin,
    options: { captureHistory?: boolean } = {}
  ): DispatchResult => {
    const doc = this.documentStore.get()
    const reduced = reduceOperations(doc, operations, {
      now: this.now,
      origin,
      registries: this.createKernelRegistriesSnapshot()
    })
    if (!reduced.ok) {
      return reduced
    }

    this.commitDocument(reduced.doc)
    if (options.captureHistory !== false) {
      this.historyStore.capture({
        forward: reduced.changes.operations,
        inverse: reduced.inverse,
        origin,
        timestamp: reduced.changes.timestamp
      })
    }

    return {
      ok: true,
      changes: reduced.changes
    }
  }

  private toOperationTypes = (
    operations: Operation[],
    extraTypes: string[] = []
  ): string[] => {
    const types = new Set<string>(extraTypes)
    operations.forEach((operation) => {
      types.add(operation.type)
    })
    return Array.from(types)
  }

  private syncDoc = () => {
    const docAfter = this.documentStore.get()
    this.replaceDoc(docAfter)
    return docAfter
  }

  private syncGraphAndView = (operations: Operation[]) => {
    const graphChange = this.graphRuntime.syncAfterMutations(operations)
    this.viewRuntime.sync(graphChange)
  }

  private emitDocChanged = (
    docId: string | undefined,
    source: CommandSource,
    operationTypes: string[]
  ) => {
    if (!operationTypes.length) return
    this.emit('doc.changed', {
      docId,
      operationTypes,
      origin: this.toOrigin(source)
    })
  }

  private createSummary = (options: {
    id: string
    docId?: string
    source: CommandSource
    actor?: string
    timestamp: number
    commandTypes: Command['type'][]
    operationTypes: string[]
    startedAt: number
    commandCount: number
    dispatchCount: number
  }): AppliedChangeSummary => ({
    id: options.id,
    docId: options.docId,
    source: options.source,
    actor: options.actor,
    timestamp: options.timestamp,
    commandTypes: options.commandTypes,
    operationTypes: options.operationTypes,
    metrics: {
      durationMs: this.now() - options.startedAt,
      commandCount: options.commandCount,
      dispatchCount: options.dispatchCount
    }
  })

  private applyHistoryOperations = (
    operations: Operation[]
  ): boolean => {
    const dispatchResult = this.reduceWithCommit(operations, 'system', {
      captureHistory: false
    })
    if (!dispatchResult.ok) {
      return false
    }

    const docAfter = this.syncDoc()
    this.syncGraphAndView(dispatchResult.changes.operations)
    this.emitDocChanged(
      docAfter?.id,
      'system',
      this.toOperationTypes(dispatchResult.changes.operations)
    )
    return true
  }

  readonly history = {
    configure: (config: Partial<ResolvedHistoryConfig>) => {
      this.historyStore.configure(config)
    },
    undo: () => this.historyStore.undo(this.applyHistoryOperations),
    redo: () => this.historyStore.redo(this.applyHistoryOperations),
    clear: () => this.historyStore.clear(),
    getState: (): HistoryState => this.historyStore.getState(),
    subscribe: (listener: (state: HistoryState) => void) =>
      this.historyStore.subscribe(listener)
  }

  dispatchIntent = async (
    intent: Intent,
    options: IntentDispatchOptions = {}
  ): Promise<DispatchResult> => {
    const source = options.source ?? 'command'
    const origin = this.toOrigin(source)
    const built = buildIntent(this.documentStore.get(), intent, {
      now: this.now,
      registries: this.createKernelRegistriesSnapshot()
    })
    if (!built.ok) {
      return built
    }

    const dispatchResult = this.reduceWithCommit(built.operations, origin)
    const operations = dispatchResult.ok ? dispatchResult.changes.operations : []
    const docAfter = this.syncDoc()
    this.syncGraphAndView(operations)
    this.emitDocChanged(
      options.docId ?? docAfter?.id,
      source,
      this.toOperationTypes(operations)
    )

    if (!dispatchResult.ok || typeof built.value === 'undefined') {
      return dispatchResult
    }
    return {
      ...dispatchResult,
      value: built.value
    }
  }

  resetDocument = async (
    doc: Document,
    options: ResetDocumentOptions = {}
  ): Promise<DispatchResult> => {
    const source = options.source ?? 'import'
    const origin = this.toOrigin(source)

    this.instance.graph.applyHint({ kind: 'full' }, 'doc')
    this.commitDocument(doc, { silent: true })
    this.historyStore.clear()

    const docAfter = this.syncDoc()
    this.syncGraphAndView([])
    this.emitDocChanged(docAfter?.id, source, ['doc.reset'])

    return {
      ok: true,
      changes: {
        id: this.createBatchId('ms'),
        timestamp: options.timestamp ?? this.now(),
        operations: [],
        origin
      }
    }
  }

  applyMutations: ApplyMutationsApi = async (
    input: MutationBatchInput
  ): Promise<ApplyMutationsResult> => {
    const startedAt = this.now()
    const mutationBatch = this.createMutationBatch(input)
    const origin = this.toOrigin(mutationBatch.source)
    const dispatchResult = this.reduceWithCommit(mutationBatch.operations, origin)
    const operations = dispatchResult.ok ? dispatchResult.changes.operations : []
    const operationTypes = this.toOperationTypes(operations)
    const docAfter = this.syncDoc()

    const summary = this.createSummary({
      id: mutationBatch.id,
      docId: mutationBatch.docId ?? docAfter?.id,
      source: mutationBatch.source,
      actor: mutationBatch.actor,
      timestamp: mutationBatch.timestamp,
      commandTypes: [],
      operationTypes,
      startedAt,
      commandCount: 0,
      dispatchCount: 1
    })

    const applied: ApplyMutationsResult = {
      mutationBatch,
      dispatchResult,
      operations,
      summary
    }

    this.syncGraphAndView(applied.operations)
    this.emitDocChanged(summary.docId, summary.source, summary.operationTypes)
    return applied
  }
}
