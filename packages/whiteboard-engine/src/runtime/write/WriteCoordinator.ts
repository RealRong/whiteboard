import type { ApplyMutationsApi, CommandSource } from '@engine-types/command'
import type { ResolvedHistoryConfig } from '@engine-types/common'
import type { DispatchResult, Document, Operation, Origin } from '@whiteboard/core/types'
import type { HistoryDomain } from '../history/HistoryDomain'
import type {
  MutationAppliedChange,
  MutationExecutionResult,
  MutationExecutor
} from './MutationExecutor'

type ResetDocumentOptions = {
  source?: CommandSource
  timestamp?: number
}

type WriteCoordinatorOptions = {
  executor: MutationExecutor
  history: HistoryDomain
  publishApplied?: (change: MutationAppliedChange) => void
}

export class WriteCoordinator {
  private readonly executor: MutationExecutor
  private readonly historyDomain: HistoryDomain
  private readonly publishApplied: (change: MutationAppliedChange) => void

  constructor({
    executor,
    history,
    publishApplied
  }: WriteCoordinatorOptions) {
    this.executor = executor
    this.historyDomain = history
    this.publishApplied = publishApplied ?? (() => {})
  }

  private applyOperations = (
    operations: Operation[],
    origin: Origin
  ): MutationExecutionResult => {
    const result = this.executor.applyOperations(operations, origin)
    if (result.ok) {
      this.publishApplied(result.applied)
    }
    return result
  }

  private applyHistoryOperations = (
    operations: Operation[]
  ): boolean => {
    const result = this.applyOperations(operations, 'system')
    return result.ok
  }

  readonly history = {
    get: () => this.historyDomain.getState(),
    configure: (config: Partial<ResolvedHistoryConfig>) => {
      this.historyDomain.configure(config)
    },
    undo: () => this.historyDomain.undo(this.applyHistoryOperations),
    redo: () => this.historyDomain.redo(this.applyHistoryOperations),
    clear: () => this.historyDomain.clear()
  }

  resetDocument = async (
    doc: Document,
    options: ResetDocumentOptions = {}
  ): Promise<DispatchResult> => {
    const source = options.source ?? 'import'
    const origin = this.toOrigin(source)

    this.historyDomain.clear()
    const result = this.executor.resetDocument({
      doc,
      origin,
      timestamp: options.timestamp
    })
    this.publishApplied(result.applied)
    return {
      ok: true,
      changes: result.changes
    }
  }

  applyMutations: ApplyMutationsApi = async (
    operations,
    source
  ) => {
    const origin = this.toOrigin(source)
    const result = this.applyOperations(operations, origin)
    if (!result.ok) {
      return result
    }

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

  private toOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }
}
