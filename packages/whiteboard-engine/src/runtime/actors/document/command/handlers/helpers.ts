import type { CommandSource } from '@engine-types/command'
import type { GraphProjector } from '@engine-types/graph'
import type { RefLike } from '@engine-types/ui'
import type { Core, DispatchResult, Document, Operation, Origin } from '@whiteboard/core'

export type ReduceContext = {
  core: Core
  graph: GraphProjector
  docRef: RefLike<Document>
}

export const toCoreOrigin = (source: CommandSource): Origin => {
  if (source === 'remote') return 'remote'
  if (source === 'system' || source === 'import') return 'system'
  return 'user'
}

export type ExecutionPlan =
  | {
      kind: 'invalid'
      message: string
    }
  | {
      kind: 'doc.reset'
      doc: Document
    }
  | {
      kind: 'operations'
      operations: Operation[]
      hasValue?: boolean
      value?: unknown
    }

export const invalidPlan = (message: string): ExecutionPlan => ({
  kind: 'invalid',
  message
})

export const resetDocPlan = (doc: Document): ExecutionPlan => ({
  kind: 'doc.reset',
  doc
})

export const operationsPlan = (operations: Operation[], value?: unknown, hasValue = false): ExecutionPlan => ({
  kind: 'operations',
  operations,
  hasValue,
  value
})

export const createUniqueId = (prefix: string, exists: (id: string) => boolean) => {
  const seed = Date.now().toString(36)
  for (let index = 0; index < 1024; index += 1) {
    const id = `${prefix}_${seed}_${index.toString(36)}`
    if (!exists(id)) return id
  }
  return `${prefix}_${seed}_${Math.random().toString(36).slice(2, 8)}`
}

const invalidResult = (message: string): DispatchResult => ({
  ok: false,
  reason: 'invalid',
  message
})

export const executeMutationPlan = (
  context: ReduceContext,
  plan: ExecutionPlan,
  origin: Origin
): DispatchResult | undefined => {
  switch (plan.kind) {
    case 'invalid':
      return invalidResult(plan.message)
    case 'doc.reset':
      context.graph.applyHint({ kind: 'full' }, 'doc')
      context.docRef.current = plan.doc
      return undefined
    case 'operations':
      const result = context.core.apply.operations(plan.operations, { origin })
      if (!result.ok) {
        return result
      }
      if (!plan.hasValue) {
        return result
      }
      return {
        ...result,
        value: plan.value
      }
    default: {
      const exhaustive: never = plan
      throw new Error(`Unknown command plan kind: ${(exhaustive as { kind?: string }).kind ?? 'unknown'}`)
    }
  }
}
