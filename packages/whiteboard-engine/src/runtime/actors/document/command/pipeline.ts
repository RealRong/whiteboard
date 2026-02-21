import type {
  ApplyDispatchResult,
  AppliedCommandSummary,
  ApplyApi,
  ApplyOptions,
  ApplyResult,
  Command,
  CommandBatch,
  CommandBatchInput,
  TxApi
} from '@engine-types/command'
import type { Operation } from '@whiteboard/core'
import type { CommandPipelineRuntimeContext } from '../../../common/contracts'
import { dispatchCommandBatch } from './execute'
import { normalizeCommandBatch } from './normalize'
import { validateCommandBatchInput } from './validate'

type CommandPipeline = {
  apply: ApplyApi
  tx: TxApi
}

export const createCommandPipeline = ({
  instance,
  replaceDoc,
  now: getNow
}: CommandPipelineRuntimeContext): CommandPipeline => {
  const collectOperations = (
    dispatchResults: ApplyDispatchResult[]
  ): Operation[] => {
    const operations: Operation[] = []
    dispatchResults.forEach(({ result }) => {
      if (!result.ok) return
      operations.push(...result.changes.operations)
    })
    return operations
  }

  const toOperationTypes = (operations: Operation[], commandBatch: CommandBatch): string[] => {
    const types = new Set<string>()
    operations.forEach((operation) => {
      types.add(operation.type)
    })
    if (commandBatch.commands.some((command) => command.type === 'doc.reset')) {
      types.add('doc.reset')
    }
    return Array.from(types)
  }

  const now = getNow ?? (() => {
    const runtime = globalThis as { performance?: { now?: () => number } }
    if (typeof runtime.performance?.now === 'function') {
      return runtime.performance.now()
    }
    return Date.now()
  })

  const apply: ApplyApi = async (input: CommandBatchInput, options?: ApplyOptions): Promise<ApplyResult> => {
    const startedAt = now()
    const validated = validateCommandBatchInput(input)
    const commandBatch = normalizeCommandBatch(validated, options, {
      docId: instance.runtime.docRef.current?.id,
      source: 'system'
    })
    const dispatchResults = await dispatchCommandBatch(
      {
        core: instance.runtime.core,
        graph: instance.graph,
        docRef: instance.runtime.docRef
      },
      commandBatch
    )
    const operations = collectOperations(dispatchResults)
    const docAfter = instance.runtime.docRef.current ?? null
    replaceDoc(docAfter)

    const operationTypes = toOperationTypes(operations, commandBatch)

    const summary: AppliedCommandSummary = {
      id: commandBatch.id,
      docId: commandBatch.docId ?? docAfter?.id,
      source: commandBatch.source,
      actor: commandBatch.actor,
      timestamp: commandBatch.timestamp,
      commandTypes: commandBatch.commands.map((command) => command.type),
      operationTypes,
      metrics: {
        durationMs: now() - startedAt,
        commandCount: commandBatch.commands.length,
        dispatchCount: dispatchResults.length
      }
    }

    return {
      commandBatch,
      dispatchResults,
      summary
    }
  }

  const tx: TxApi = async (run, options) => {
    const pending: Command[] = []
    const value = await run({
      add: (...commands) => {
        pending.push(...commands)
      }
    })
    if (!pending.length) return value
    await apply(pending, options)
    return value
  }

  return {
    apply,
    tx
  }
}
