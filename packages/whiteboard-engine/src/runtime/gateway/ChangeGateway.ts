import type {
  AppliedChangeSummary,
  ApplyDispatchResult,
  ApplyMutationsApi,
  ApplyMutationsOptions,
  ApplyMutationsResult,
  ApplyApi,
  ApplyOptions,
  ApplyResult,
  Command,
  CommandBatch,
  CommandBatchInput,
  CommandSource,
  MutationBatch,
  MutationBatchInput,
  TxApi,
  TxCollector
} from '@engine-types/command'
import type { GraphChange } from '@engine-types/graph'
import type { InstanceEventEmitter, InstanceEventMap } from '@engine-types/instance/events'
import type { InternalInstance } from '@engine-types/instance/instance'
import type { DispatchResult, Document, Intent, Operation, Origin } from '@whiteboard/core'

type GraphRuntime = {
  syncAfterApply: (applied: ApplyResult) => GraphChange | undefined
  syncAfterMutations: (operations: Operation[]) => GraphChange | undefined
}

type ViewRuntime = {
  sync: (change: GraphChange | undefined) => void
}

export type ChangeGatewayDependencies = {
  instance: InternalInstance
  replaceDoc: (doc: Document | null) => void
  now?: () => number
  graph: GraphRuntime
  view: ViewRuntime
  emit: InstanceEventEmitter['emit']
}

export class ChangeGateway {
  private readonly instance: InternalInstance
  private readonly replaceDoc: (doc: Document | null) => void
  private readonly now: () => number
  private readonly graphRuntime: ChangeGatewayDependencies['graph']
  private readonly viewRuntime: ChangeGatewayDependencies['view']
  private readonly emit: InstanceEventEmitter['emit']

  constructor({
    instance,
    replaceDoc,
    now,
    graph,
    view,
    emit
  }: ChangeGatewayDependencies) {
    this.instance = instance
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

  private createCommandBatchId = () => {
    const random = Math.random().toString(36).slice(2, 10)
    return `cs_${Date.now().toString(36)}_${random}`
  }

  private createMutationBatchId = () => {
    const random = Math.random().toString(36).slice(2, 10)
    return `ms_${Date.now().toString(36)}_${random}`
  }

  private toDocOrigin = (
    source: CommandSource
  ): InstanceEventMap['doc.changed']['origin'] => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  private toCoreOrigin = (source: CommandSource): Origin => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  private parseCommandBatchInput = (
    input: CommandBatchInput
  ): {
    commands: Command[]
    meta: Omit<Exclude<CommandBatchInput, Command[]>, 'commands'> | undefined
  } => {
    const isObjectBatch = !Array.isArray(input)
    const commands = isObjectBatch ? input.commands : input
    const meta = isObjectBatch
      ? (({ id, docId, source, actor, timestamp }) => ({
          id,
          docId,
          source,
          actor,
          timestamp
        }))(input)
      : undefined

    if (!Array.isArray(commands)) {
      throw new Error('Invalid command batch input: commands must be an array')
    }

    commands.forEach((command, index) => {
      if (!command || typeof command !== 'object' || typeof command.type !== 'string') {
        throw new Error(`Invalid command at index ${index}: missing type`)
      }
    })

    return {
      commands: commands as Command[],
      meta
    }
  }

  private normalizeCommandBatch = (
    input: ReturnType<ChangeGateway['parseCommandBatchInput']>,
    options: ApplyOptions | undefined
  ): CommandBatch => ({
    id: options?.id ?? input.meta?.id ?? this.createCommandBatchId(),
    docId: options?.docId ?? input.meta?.docId ?? this.instance.runtime.docRef.current?.id,
    source: options?.source ?? input.meta?.source ?? 'system',
    actor: options?.actor ?? input.meta?.actor,
    timestamp: options?.timestamp ?? input.meta?.timestamp ?? Date.now(),
    commands: input.commands
  })

  private normalizeMutationBatch = (
    input: MutationBatchInput,
    options: ApplyMutationsOptions | undefined
  ): MutationBatch => {
    const operations = Array.isArray(input) ? input : input.operations
    const meta = Array.isArray(input) ? undefined : input

    if (!Array.isArray(operations)) {
      throw new Error('Invalid mutation batch input: operations must be an array')
    }

    return {
      id: options?.id ?? meta?.id ?? this.createMutationBatchId(),
      docId: options?.docId ?? meta?.docId ?? this.instance.runtime.docRef.current?.id,
      source: options?.source ?? meta?.source ?? 'system',
      actor: options?.actor ?? meta?.actor,
      timestamp: options?.timestamp ?? meta?.timestamp ?? Date.now(),
      operations
    }
  }

  private applyCommand = (
    command: CommandBatch['commands'][number],
    origin: Origin
  ): DispatchResult | undefined => {
    if (command.type === 'doc.reset') {
      this.instance.graph.applyHint({ kind: 'full' }, 'doc')
      this.instance.runtime.docRef.current = command.doc
      return undefined
    }

    const built = this.instance.runtime.core.apply.build(command as Intent)
    if (!built.ok) {
      return built
    }

    const result = this.instance.runtime.core.apply.operations(built.operations, { origin })
    if (!result.ok) {
      return result
    }
    if (typeof built.value === 'undefined') {
      return result
    }

    return {
      ...result,
      value: built.value
    }
  }

  private dispatchCommandBatch = (
    commandBatch: CommandBatch
  ): ApplyDispatchResult[] => {
    const dispatchResults: ApplyDispatchResult[] = []
    const origin = this.toCoreOrigin(commandBatch.source)

    for (let index = 0; index < commandBatch.commands.length; index += 1) {
      const command = commandBatch.commands[index]
      const result = this.applyCommand(command, origin)
      if (!result) continue
      dispatchResults.push({
        index,
        type: command.type,
        result
      })
    }

    return dispatchResults
  }

  private collectOperations = (
    dispatchResults: ApplyDispatchResult[]
  ): Operation[] => {
    const operations: Operation[] = []
    dispatchResults.forEach(({ result }) => {
      if (!result.ok) return
      operations.push(...result.changes.operations)
    })
    return operations
  }

  private toOperationTypes = (
    operations: Operation[],
    commandBatch: CommandBatch
  ): string[] => {
    const types = new Set<string>()
    operations.forEach((operation) => {
      types.add(operation.type)
    })
    if (commandBatch.commands.some((command) => command.type === 'doc.reset')) {
      types.add('doc.reset')
    }
    return Array.from(types)
  }

  private emitChangeEvents = (summary: AppliedChangeSummary) => {
    if (summary.operationTypes.length) {
      this.emit('doc.changed', {
        docId: summary.docId,
        operationTypes: summary.operationTypes,
        origin: this.toDocOrigin(summary.source)
      })
    }
    this.emit('change.applied', summary)
  }

  apply: ApplyApi = async (
    input: CommandBatchInput,
    options?: ApplyOptions
  ): Promise<ApplyResult> => {
    const startedAt = this.now()
    const parsed = this.parseCommandBatchInput(input)
    const commandBatch = this.normalizeCommandBatch(parsed, options)
    const dispatchResults = this.dispatchCommandBatch(commandBatch)
    const operations = this.collectOperations(dispatchResults)
    const docAfter = this.instance.runtime.docRef.current ?? null
    this.replaceDoc(docAfter)
    const operationTypes = this.toOperationTypes(operations, commandBatch)

    const summary: AppliedChangeSummary = {
      id: commandBatch.id,
      docId: commandBatch.docId ?? docAfter?.id,
      source: commandBatch.source,
      actor: commandBatch.actor,
      timestamp: commandBatch.timestamp,
      commandTypes: commandBatch.commands.map((command) => command.type),
      operationTypes,
      metrics: {
        durationMs: this.now() - startedAt,
        commandCount: commandBatch.commands.length,
        dispatchCount: dispatchResults.length
      }
    }

    const applied: ApplyResult = {
      commandBatch,
      dispatchResults,
      summary
    }

    const graphChange = this.graphRuntime.syncAfterApply(applied)
    this.viewRuntime.sync(graphChange)
    this.emitChangeEvents(summary)
    return applied
  }

  applyMutations: ApplyMutationsApi = async (
    input: MutationBatchInput,
    options?: ApplyMutationsOptions
  ): Promise<ApplyMutationsResult> => {
    const startedAt = this.now()
    const mutationBatch = this.normalizeMutationBatch(input, options)
    const origin = this.toCoreOrigin(mutationBatch.source)
    const dispatchResult = this.instance.runtime.core.apply.operations(mutationBatch.operations, { origin })
    const operations = dispatchResult.ok ? dispatchResult.changes.operations : []
    const operationTypes = Array.from(new Set(operations.map((operation) => operation.type)))
    const docAfter = this.instance.runtime.docRef.current ?? null
    this.replaceDoc(docAfter)

    const summary: AppliedChangeSummary = {
      id: mutationBatch.id,
      docId: mutationBatch.docId ?? docAfter?.id,
      source: mutationBatch.source,
      actor: mutationBatch.actor,
      timestamp: mutationBatch.timestamp,
      commandTypes: [],
      operationTypes,
      metrics: {
        durationMs: this.now() - startedAt,
        commandCount: 0,
        dispatchCount: 1
      }
    }

    const applied: ApplyMutationsResult = {
      mutationBatch,
      dispatchResult,
      operations,
      summary
    }

    const graphChange = this.graphRuntime.syncAfterMutations(applied.operations)
    this.viewRuntime.sync(graphChange)
    this.emitChangeEvents(summary)
    return applied
  }

  tx: TxApi = async <T>(
    run: (tx: TxCollector) => T | Promise<T>,
    options?: ApplyOptions
  ): Promise<T> => {
    const pending: Command[] = []
    const value = await run({
      add: (...commands) => {
        pending.push(...commands)
      }
    })
    if (!pending.length) return value
    await this.apply(pending, options)
    return value
  }
}
