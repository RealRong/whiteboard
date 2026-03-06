import type {
  WriteDomain,
  WriteInput
} from '@engine-types/command/api'
import type {
  DispatchResult,
  Operation
} from '@whiteboard/core/types'

export type Apply = <D extends WriteDomain>(
  payload: WriteInput<D>
) => Promise<DispatchResult>

type Failure = Extract<DispatchResult, { ok: false }>

export type Draft =
  | {
      ok: true
      operations: readonly Operation[]
    }
  | Failure

export const success = (operations: readonly Operation[]): Draft => ({
  ok: true,
  operations
})

export const invalid = (message: string): Draft => ({
  ok: false,
  reason: 'invalid',
  message
})

export const cancelled = (message?: string): Draft => ({
  ok: false,
  reason: 'cancelled',
  message
})

export const merge = (...drafts: Draft[]): Draft => {
  const operations: Operation[] = []

  for (const draft of drafts) {
    if (!draft.ok) return draft
    operations.push(...draft.operations)
  }

  return success(operations)
}

type FailLike = {
  ok: false
  message?: string
}

type OpLike = {
  ok: true
  operation: Operation
}

type OpsLike = {
  ok: true
  operations: readonly Operation[]
}

const failMessage = (result: FailLike) =>
  result.message ?? 'Invalid result.'

export const op = (result: OpLike | FailLike): Draft =>
  result.ok
    ? success([result.operation])
    : invalid(failMessage(result))

export const ops = (result: OpsLike | FailLike): Draft =>
  result.ok
    ? success(result.operations)
    : invalid(failMessage(result))
