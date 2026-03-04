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

export type Draft<T = unknown> =
  | {
      ok: true
      operations: readonly Operation[]
      value?: T
    }
  | Failure

export const success = <T,>(operations: readonly Operation[], value?: T): Draft<T> => ({
  ok: true,
  operations,
  value
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
