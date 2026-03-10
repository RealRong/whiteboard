import type { DispatchFailure, DispatchFailureReason } from '@whiteboard/core/types'

export const failure = (
  reason: DispatchFailureReason,
  message?: string
): DispatchFailure => ({
  ok: false,
  reason,
  message
})

export const invalid = (message: string): DispatchFailure =>
  failure('invalid', message)

export const cancelled = (message?: string): DispatchFailure =>
  failure('cancelled', message)
