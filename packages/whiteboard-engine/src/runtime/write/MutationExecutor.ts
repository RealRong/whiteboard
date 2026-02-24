import type { ProjectionStore } from '@engine-types/projection'
import type { InternalInstance } from '@engine-types/instance/instance'
import { FULL_MUTATION_IMPACT, affectsProjection, hasImpactTag } from '../mutation/Impact'
import { MutationImpactAnalyzer } from '../mutation/Analyzer'
import { reduceOperations } from '@whiteboard/core/kernel'
import type { KernelRegistriesSnapshot } from '@whiteboard/core/kernel'
import type {
  ChangeSet,
  DispatchFailure,
  Document,
  Operation,
  Origin
} from '@whiteboard/core/types'

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
  instance: Pick<InternalInstance, 'document' | 'registries'>
  projection: ProjectionStore
  syncState: () => void
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
  private readonly projection: ProjectionStore
  private readonly syncState: () => void
  private readonly now: () => number
  private readonly impactAnalyzer = new MutationImpactAnalyzer()

  constructor({
    instance,
    projection,
    syncState,
    now
  }: MutationExecutorOptions) {
    this.instance = instance
    this.projection = projection
    this.syncState = syncState
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

  private syncDocumentState = () => {
    this.syncState()
    return this.instance.document.get()
  }

  private syncProjectionState = (
    operations: Operation[],
    impact = this.impactAnalyzer.analyze(operations)
  ) => {
    if (!affectsProjection(impact)) return
    const full = hasImpactTag(impact, 'full')
    if (full) {
      this.projection.replace('doc')
      return
    }
    this.projection.apply({
      source: 'doc',
      dirtyNodeIds: impact.dirtyNodeIds
    })
  }

  applyOperations = (
    operations: Operation[],
    origin: Origin
  ): MutationExecutionResult => {
    const doc = this.instance.document.get()
    const reduced = reduceOperations(doc, operations, {
      now: this.now,
      origin,
      registries: this.createKernelRegistriesSnapshot()
    })
    if (!reduced.ok) {
      return reduced
    }

    this.commitDocument(reduced.doc)
    const docAfter = this.syncDocumentState()
    this.syncProjectionState(reduced.changes.operations)
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
    this.commitDocument(doc, { silent: true })
    const docAfter = this.syncDocumentState()
    this.syncProjectionState([], FULL_MUTATION_IMPACT)
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
