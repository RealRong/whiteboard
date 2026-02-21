import type {
  AppliedCommandSummary,
  ApplyApi,
  ApplyOptions,
  ApplyResult,
  Command,
  CommandBatchInput,
  CommandSource,
  TxApi,
  TxCollector
} from '@engine-types/command'
import type { GraphChange } from '@engine-types/graph'
import type { InstanceEventEmitter, InstanceEventMap } from '@engine-types/instance/events'

type GraphRuntime = {
  syncAfterApply: (applied: ApplyResult) => GraphChange | undefined
}

type ViewRuntime = {
  sync: (change: GraphChange | undefined) => void
}

export type CommandGatewayDependencies = {
  apply: ApplyApi
  graph: GraphRuntime
  view: ViewRuntime
  emit: InstanceEventEmitter['emit']
}

export class CommandGateway {
  private readonly applyRuntime: ApplyApi
  private readonly graphRuntime: CommandGatewayDependencies['graph']
  private readonly viewRuntime: CommandGatewayDependencies['view']
  private readonly emit: InstanceEventEmitter['emit']

  constructor({
    apply,
    graph,
    view,
    emit
  }: CommandGatewayDependencies) {
    this.applyRuntime = apply
    this.graphRuntime = graph
    this.viewRuntime = view
    this.emit = emit
  }

  private toDocOrigin = (
    source: CommandSource
  ): InstanceEventMap['doc.changed']['origin'] => {
    if (source === 'remote') return 'remote'
    if (source === 'system' || source === 'import') return 'system'
    return 'user'
  }

  private emitCommandEvents = (summary: AppliedCommandSummary) => {
    if (summary.operationTypes.length) {
      this.emit('doc.changed', {
        docId: summary.docId,
        operationTypes: summary.operationTypes,
        origin: this.toDocOrigin(summary.source)
      })
    }
    this.emit('command.applied', summary)
  }

  applyChange = async (
    input: CommandBatchInput,
    options?: ApplyOptions
  ): Promise<ApplyResult> => {
    const applied = await this.applyRuntime(input, options)
    const graphChange = this.graphRuntime.syncAfterApply(applied)
    this.viewRuntime.sync(graphChange)
    this.emitCommandEvents(applied.summary)
    return applied
  }

  runTransaction: TxApi = async <T>(
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
    await this.applyChange(pending, options)
    return value
  }

  apply: ApplyApi = async (input, options) =>
    this.applyChange(input, options)

  tx: TxApi = async (run, options) =>
    this.runTransaction(run, options)
}
