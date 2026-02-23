import type {
  ApplyMutationsApi,
  CommandSource
} from '@engine-types/command'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { HistoryState } from '@engine-types/state'
import type { ProjectionChange, ProjectionStore } from '@engine-types/projection'
import type { DocumentStore } from '../../document/Store'
import type { HistoryStore } from '../../document/History'
import type { MutationImpact } from '../mutation/Impact'
import { FULL_MUTATION_IMPACT, affectsProjection, hasImpactTag } from '../mutation/Impact'
import { MutationImpactAnalyzer } from '../mutation/Analyzer'
import {
  reduceOperations
} from '@whiteboard/core/kernel'
import type {
  CoreRegistries,
  DispatchResult,
  Document,
  KernelRegistriesSnapshot,
  Operation,
  Origin
} from '@whiteboard/core/types'

type ProjectionSink = {
  applyProjection: (change: ProjectionChange) => void
}

type ResetDocumentOptions = {
  source?: CommandSource
  timestamp?: number
}

type AppliedChange = {
  docId: string | undefined
  origin: Origin
  operations: Operation[]
  reset?: boolean
}

export type ChangeGatewayDependencies = {
  documentStore: DocumentStore
  history: HistoryStore
  registries: CoreRegistries
  projection: ProjectionStore
  sinks: ProjectionSink[]
  syncStateFromDocument: () => void
  now?: () => number
  onApplied?: (change: AppliedChange) => void
}

export class ChangeGateway {
  private readonly documentStore: DocumentStore
  private readonly historyStore: HistoryStore
  private readonly registries: CoreRegistries
  private readonly projection: ProjectionStore
  private readonly sinks: ProjectionSink[]
  private readonly syncStateFromDocument: () => void
  private readonly now: () => number
  private readonly onApplied?: (change: AppliedChange) => void
  private readonly impactAnalyzer = new MutationImpactAnalyzer()

  constructor({
    documentStore,
    history,
    registries,
    projection,
    sinks,
    syncStateFromDocument,
    now,
    onApplied
  }: ChangeGatewayDependencies) {
    this.documentStore = documentStore
    this.historyStore = history
    this.registries = registries
    this.projection = projection
    this.sinks = sinks
    this.syncStateFromDocument = syncStateFromDocument
    this.onApplied = onApplied
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

  private toOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

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

  private syncDocumentState = () => {
    this.syncStateFromDocument()
    return this.documentStore.get()
  }

  private syncGraphAndView = (
    operations: Operation[],
    impact = this.impactAnalyzer.analyze(operations)
  ) => {
    if (!affectsProjection(impact)) return
    const full = hasImpactTag(impact, 'full')
    const orderChanged = hasImpactTag(impact, 'order') ? true : undefined
    const change = this.projection.sync({
      source: 'doc',
      full,
      dirtyNodeIds: impact.dirtyNodeIds,
      orderChanged
    })
    if (!change) return
    this.sinks.forEach((sink) => {
      sink.applyProjection(change)
    })
  }

  private notifyApplied = (change: AppliedChange) => {
    if (!change.reset && !change.operations.length) return
    this.onApplied?.(change)
  }

  private applyHistoryOperations = (
    operations: Operation[]
  ): boolean => {
    const dispatchResult = this.reduceWithCommit(operations, 'system', {
      captureHistory: false
    })
    if (!dispatchResult.ok) {
      return false
    }

    const docAfter = this.syncDocumentState()
    this.syncGraphAndView(dispatchResult.changes.operations)
    this.notifyApplied({
      docId: docAfter?.id,
      origin: 'system',
      operations: dispatchResult.changes.operations
    })
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

  resetDocument = async (
    doc: Document,
    options: ResetDocumentOptions = {}
  ): Promise<DispatchResult> => {
    const source = options.source ?? 'import'
    const origin = this.toOrigin(source)

    this.commitDocument(doc, { silent: true })
    this.historyStore.clear()

    const docAfter = this.syncDocumentState()
    this.syncGraphAndView([], FULL_MUTATION_IMPACT)
    this.notifyApplied({
      docId: docAfter?.id,
      origin,
      operations: [],
      reset: true
    })

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
    operations,
    source
  ): Promise<DispatchResult> => {
    const origin = this.toOrigin(source)
    const dispatchResult = this.reduceWithCommit(operations, origin)
    if (!dispatchResult.ok) {
      return dispatchResult
    }

    const appliedOperations = dispatchResult.changes.operations
    const docAfter = this.syncDocumentState()
    this.syncGraphAndView(appliedOperations)
    this.notifyApplied({
      docId: docAfter?.id,
      origin,
      operations: appliedOperations
    })
    return dispatchResult
  }
}
