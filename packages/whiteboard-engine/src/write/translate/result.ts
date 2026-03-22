import type { Operation } from '@whiteboard/core/types'
import type { CommandFailure } from '@engine-types/result'
import { cancelled as cancelledResult, failure, invalid as invalidResult } from '../result'

export type DraftFailure = CommandFailure

export type DraftSuccess<T = void> = {
  ok: true
  data: {
    operations: readonly Operation[]
    output: T
  }
}

export type Draft<T = void> =
  | DraftSuccess<T>
  | DraftFailure

export function success(operations: readonly Operation[]): Draft<void>
export function success<T>(operations: readonly Operation[], output: T): Draft<T>
export function success<T>(operations: readonly Operation[], output?: T): Draft<T> {
  return {
    ok: true,
    data: {
      operations,
      output: output as T
    }
  }
}

export const invalid = (message: string, details?: unknown): DraftFailure =>
  invalidResult(message, details)

export const cancelled = (message?: string, details?: unknown): DraftFailure =>
  cancelledResult(message, details)

export const mergeKeepOutput = <T>(
  base: Draft<T>,
  ...drafts: Draft<void>[]
): Draft<T> => {
  if (!base.ok) return base

  const operations: Operation[] = [...base.data.operations]

  for (const draft of drafts) {
    if (!draft.ok) return draft
    operations.push(...draft.data.operations)
  }

  return success(operations, base.data.output)
}

type FailLike = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}

type OpLike<TData extends { operation: Operation }> = {
  ok: true
  data: TData
}

type OpsLike<TData extends { operations: readonly Operation[] }> = {
  ok: true
  data: TData
}

const toOutput = <TData, TOutput>(
  data: TData,
  select?: (data: TData) => TOutput
) =>
  select ? select(data) : undefined as TOutput

export const op = <
  TData extends { operation: Operation },
  TOutput = void
>(
  result: OpLike<TData> | FailLike,
  select?: (data: TData) => TOutput
): Draft<TOutput> =>
  result.ok
    ? success([result.data.operation], toOutput(result.data, select))
    : failure(result.error.code, result.error.message, result.error.details)

export const ops = <
  TData extends { operations: readonly Operation[] },
  TOutput = void
>(
  result: OpsLike<TData> | FailLike,
  select?: (data: TData) => TOutput
): Draft<TOutput> =>
  result.ok
    ? success(result.data.operations, toOutput(result.data, select))
    : failure(result.error.code, result.error.message, result.error.details)
